"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Square,
  SkipForward,
  Loader2,
  User,
  ChevronRight,
  Clock,
  AlertTriangle,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import PageTransition from "@/components/PageTransition";
import type { MockQuestion, AnswerEvaluation } from "@/lib/mock-interview-types";
import { incrementMockInterview } from "@/lib/chatLimit";

// ---------- Types ----------
type SessionPhase =
  | "init"
  | "speaking-ai"
  | "ready-to-answer"
  | "listening"
  | "evaluating"
  | "feedback"
  | "complete";

type InputMode = "voice" | "text";

interface SessionData {
  sessionId: string;
  interviewerProfile: { name: string; role: string };
  openingMessage: string;
  firstQuestion: MockQuestion;
}

// ---------- Fetch with Retry ----------
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("リクエストに失敗しました");
}

// ---------- Text Chunking for TTS ----------
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = -1;
    for (let i = Math.min(maxLength, remaining.length) - 1; i >= 0; i--) {
      if (["。", "、", "！", "？", "．", "，"].includes(remaining[i])) {
        splitIndex = i + 1;
        break;
      }
    }
    if (splitIndex === -1) splitIndex = maxLength;
    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);
  }
  return chunks;
}

// ---------- Sound Wave ----------
function SoundWave() {
  return (
    <div className="sound-wave">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bar" />
      ))}
    </div>
  );
}

// ---------- Timer ----------
function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ---------- Speech Recognition Hook (iOS Safari compatible) ----------
function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualStop = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = false; // iOS: continuous=true is unstable
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final);
        setInterimTranscript("");
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onend = () => {
      // iOS: continuous=false causes auto-end. Restart if not manual stop.
      if (!isManualStop.current) {
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setIsListening(false);
      } else if (event.error === "no-speech") {
        // iOS: no-speech fires frequently - auto-restart
        if (!isManualStop.current) {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognition.start();
            } catch {
              setIsListening(false);
            }
          }, 100);
        }
      } else if (event.error === "aborted") {
        setIsListening(false);
      } else {
        if (!isManualStop.current) {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognition.start();
            } catch {
              setIsListening(false);
            }
          }, 300);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    isManualStop.current = false;
    setTranscript("");
    setInterimTranscript("");

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch {
            /* ignore */
          }
        }, 100);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    isManualStop.current = true;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  };
}

// ---------- Speech Synthesis Hook (iOS Safari compatible) ----------
function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      voicesRef.current = voices;
      if (voices.length > 0) setIsReady(true);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // iOS: background tab stops synthesis
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.speechSynthesis.cancel();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const speak = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!("speechSynthesis" in window)) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        cancelledRef.current = false;

        const chunks = splitTextIntoChunks(text, 200);
        let currentChunk = 0;

        const speakChunk = () => {
          if (cancelledRef.current || currentChunk >= chunks.length) {
            setIsSpeaking(false);
            resolve();
            return;
          }

          const utterance = new SpeechSynthesisUtterance(chunks[currentChunk]);
          utterance.lang = "ja-JP";
          utterance.rate = 0.95;
          utterance.pitch = 1.0;

          const voices = voicesRef.current;
          const japaneseVoice =
            voices.find((v) => v.lang === "ja-JP" && v.localService) ||
            voices.find((v) => v.lang === "ja-JP") ||
            voices.find((v) => v.lang.startsWith("ja"));
          if (japaneseVoice) utterance.voice = japaneseVoice;

          utterance.onstart = () => setIsSpeaking(true);
          utterance.onend = () => {
            currentChunk++;
            speakChunk();
          };
          utterance.onerror = () => {
            setIsSpeaking(false);
            resolve();
          };

          window.speechSynthesis.speak(utterance);

          // iOS: onend may not fire - fallback timeout
          const estimatedDuration = chunks[currentChunk].length * 150;
          setTimeout(() => {
            if (
              !window.speechSynthesis.speaking &&
              currentChunk < chunks.length
            ) {
              currentChunk++;
              speakChunk();
            }
          }, estimatedDuration + 2000);
        };

        speakChunk();
      });
    },
    [],
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isSupported, isReady };
}

// ---------- Main Session Component ----------
function MockInterviewSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";

  const [phase, setPhase] = useState<SessionPhase>("init");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const answerStartRef = useRef(Date.now());
  const typingCancelRef = useRef(false);

  const timer = useTimer();
  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();

  // Auto-switch to text mode if speech not supported
  useEffect(() => {
    if (!speech.isSupported) {
      setInputMode("text");
    }
  }, [speech.isSupported]);

  // iOS: Lock body scroll during interview
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, []);

  // Typing animation for AI question display
  const showQuestionWithTyping = useCallback(
    async (text: string) => {
      typingCancelRef.current = false;
      setIsTyping(true);
      setDisplayedText("");

      for (let i = 0; i < text.length; i++) {
        if (typingCancelRef.current) break;
        await new Promise((r) => setTimeout(r, 30));
        setDisplayedText(text.slice(0, i + 1));
      }
      setDisplayedText(text);
      setIsTyping(false);
    },
    [],
  );

  // Show question with typing + optional TTS
  const showQuestion = useCallback(
    async (question: string, transition?: string) => {
      const textToShow = transition ? `${transition}\n\n${question}` : question;
      const typingPromise = showQuestionWithTyping(textToShow);

      if (tts.isSupported && tts.isReady) {
        try {
          if (transition) await tts.speak(transition);
          await tts.speak(question);
        } catch {
          /* text-only fallback */
        }
      }

      await typingPromise;
    },
    [tts, showQuestionWithTyping],
  );

  // Navigate to result with fallback
  const navigateToResult = useCallback(
    (sid: string) => {
      const url = `/mock-interview/result?sessionId=${sid}`;
      try {
        router.push(url);
        setTimeout(() => {
          if (window.location.pathname !== "/mock-interview/result") {
            window.location.href = url;
          }
        }, 2000);
      } catch {
        window.location.href = url;
      }
    },
    [router],
  );

  // Load session data
  useEffect(() => {
    try {
      const saved = localStorage.getItem("career-ai-mock-session");
      if (saved) {
        const data = JSON.parse(saved) as SessionData;
        setSessionData(data);
        setCurrentQuestion(data.firstQuestion.question);
        // Attempt to get total questions
        setTotalQuestions(data.firstQuestion?.id ? 8 : 5);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Initialize session - speak opening + first question
  useEffect(() => {
    if (sessionData && phase === "init") {
      const init = async () => {
        try {
          const res = await fetch(
            `/api/mock-interview/summary?id=${sessionId}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.questions) setTotalQuestions(data.questions.length);
          }
        } catch {
          /* ignore - use default */
        }

        setPhase("speaking-ai");
        await showQuestion(
          sessionData.firstQuestion.question,
          sessionData.openingMessage,
        );
        setPhase("ready-to-answer");
        answerStartRef.current = Date.now();
      };
      init();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData]);

  // Save progress to localStorage
  const saveProgress = useCallback(() => {
    try {
      localStorage.setItem(
        "career-ai-mock-progress",
        JSON.stringify({
          sessionId,
          currentQuestionIndex,
          timestamp: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
  }, [sessionId, currentQuestionIndex]);

  // Start recording
  const handleStartAnswer = useCallback(() => {
    if (inputMode === "text") {
      setPhase("listening");
      answerStartRef.current = Date.now();
      return;
    }
    speech.startListening();
    setPhase("listening");
    answerStartRef.current = Date.now();
  }, [inputMode, speech]);

  // Submit answer
  const handleSubmitAnswer = useCallback(
    async (overrideText?: string) => {
      const answerText =
        overrideText || (inputMode === "text" ? textInput : speech.transcript);
      if (!answerText.trim()) {
        alert("回答が空です。もう一度お話しください。");
        return;
      }

      if (inputMode === "voice") speech.stopListening();
      setPhase("evaluating");
      setIsProcessing(true);

      const duration = Math.round(
        (Date.now() - answerStartRef.current) / 1000,
      );

      try {
        const res = await fetchWithRetry("/api/mock-interview/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionIndex: currentQuestionIndex,
            question: currentQuestion,
            answer: answerText,
            answerDuration: duration,
          }),
        });

        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "評価に失敗しました");
        }

        const eval_ = await res.json();
        setEvaluation(eval_);
        setPhase("feedback");
        saveProgress();
      } catch (err) {
        setError(err instanceof Error ? err.message : "評価に失敗しました");
        setPhase("feedback");
      } finally {
        setIsProcessing(false);
      }
    },
    [
      inputMode,
      textInput,
      speech,
      sessionId,
      currentQuestionIndex,
      currentQuestion,
      saveProgress,
    ],
  );

  // Finish interview
  const handleFinish = useCallback(async () => {
    tts.stop();
    if (speech.isListening) speech.stopListening();
    typingCancelRef.current = true;

    incrementMockInterview();

    try {
      const res = await fetchWithRetry("/api/mock-interview/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (res.ok) {
        const summary = await res.json();
        localStorage.setItem(
          "career-ai-mock-result",
          JSON.stringify({
            sessionId,
            summary,
            settings: sessionData?.interviewerProfile,
          }),
        );
      }
    } catch {
      /* continue to result page anyway */
    }

    // Clean up progress
    try {
      localStorage.removeItem("career-ai-mock-progress");
    } catch {
      /* ignore */
    }

    navigateToResult(sessionId);
  }, [sessionId, sessionData, speech, tts, navigateToResult]);

  // Next question
  const handleNextQuestion = useCallback(async () => {
    setEvaluation(null);
    setError(null);
    speech.resetTranscript();
    setTextInput("");
    setIsProcessing(true);

    try {
      const res = await fetchWithRetry("/api/mock-interview/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, currentQuestionIndex }),
      });

      if (!res.ok) throw new Error("次の質問の取得に失敗しました");
      const data = await res.json();

      if (data.isComplete) {
        setPhase("complete");
        handleFinish();
        return;
      }

      setCurrentQuestionIndex(data.questionIndex);
      setCurrentQuestion(data.question);

      setPhase("speaking-ai");
      await showQuestion(data.question, data.transition);
      setPhase("ready-to-answer");
      answerStartRef.current = Date.now();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentQuestionIndex, speech, showQuestion]);

  // Skip question
  const handleSkip = useCallback(() => {
    if (speech.isListening) speech.stopListening();
    tts.stop();
    typingCancelRef.current = true;
    handleNextQuestion();
  }, [speech, tts, handleNextQuestion]);

  // End interview early
  const handleEndEarly = useCallback(() => {
    if (confirm("面接を終了しますか？これまでの回答は保存されます。")) {
      handleFinish();
    }
  }, [handleFinish]);

  if (!sessionData) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-[100dvh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </PageTransition>
    );
  }

  const progressPercent =
    totalQuestions > 0
      ? ((currentQuestionIndex + (phase === "feedback" ? 1 : 0)) /
          totalQuestions) *
        100
      : 0;

  return (
    <PageTransition>
      <main className="relative z-10 min-h-[100dvh] flex flex-col py-6 px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col space-y-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              <span className="font-bold text-sm">模擬面接中</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {timer}
              </Badge>
              <Badge variant="outline">
                質問 {currentQuestionIndex + 1}/{totalQuestions || "?"}
              </Badge>
            </div>
          </div>

          {/* Progress */}
          <Progress value={progressPercent} className="h-2 flex-shrink-0" />

          {/* Interviewer Card */}
          <Card className="overflow-hidden flex-shrink-0">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">
                    {sessionData.interviewerProfile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sessionData.interviewerProfile.role}
                  </p>
                </div>
              </div>

              {/* AI speaking animation */}
              {(phase === "speaking-ai" || tts.isSpeaking) && (
                <div className="flex justify-center py-2">
                  <SoundWave />
                </div>
              )}

              {/* Current question with typing animation */}
              <p className="text-base font-medium leading-relaxed">
                &ldquo;
                {isTyping || displayedText
                  ? displayedText
                  : currentQuestion}
                {isTyping && (
                  <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                )}
                &rdquo;
              </p>
            </CardContent>
          </Card>

          {/* Answer Area */}
          <AnimatePresence mode="wait">
            {/* Listening / Input */}
            {(phase === "ready-to-answer" || phase === "listening") && (
              <motion.div
                key="answer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">あなたの回答</p>
                      {/* Voice/Text toggle */}
                      {speech.isSupported && (
                        <button
                          className="text-xs text-muted-foreground underline touch-manipulation min-h-[44px] flex items-center gap-1"
                          onClick={() => {
                            if (speech.isListening) speech.stopListening();
                            setInputMode((prev) =>
                              prev === "voice" ? "text" : "voice",
                            );
                          }}
                        >
                          {inputMode === "voice" ? (
                            <>
                              <Keyboard className="w-3 h-3" />
                              テキストで回答
                            </>
                          ) : (
                            <>
                              <Mic className="w-3 h-3" />
                              音声で回答
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {inputMode === "text" ? (
                      /* Text input mode */
                      <div className="space-y-3">
                        <Textarea
                          placeholder="ここに回答を入力してください..."
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          rows={5}
                          className="min-h-[120px] text-base resize-none"
                          style={{ fontSize: "16px" }} // Prevent iOS auto-zoom
                        />
                        <Button
                          className="w-full gap-2 min-h-[48px] touch-manipulation"
                          onClick={() => handleSubmitAnswer()}
                          disabled={!textInput.trim() || isProcessing}
                        >
                          <ChevronRight className="w-4 h-4" />
                          回答を送信する
                        </Button>
                      </div>
                    ) : (
                      /* Voice mode */
                      <>
                        {speech.isListening && (
                          <div className="flex justify-center py-2">
                            <SoundWave />
                          </div>
                        )}

                        <div className="min-h-[80px] p-3 bg-muted/50 rounded-lg text-sm">
                          {speech.transcript || speech.interimTranscript ? (
                            <>
                              {speech.transcript}
                              {speech.interimTranscript && (
                                <span className="text-muted-foreground">
                                  {speech.interimTranscript}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">
                              {speech.isListening
                                ? "話してください..."
                                : "ボタンを押して話し始めてください"}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-3">
                          {!speech.isListening ? (
                            <button
                              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-4 min-h-[56px] bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold active:scale-95 transition-transform touch-manipulation"
                              onClick={handleStartAnswer}
                              disabled={phase !== "ready-to-answer"}
                            >
                              <Mic className="w-5 h-5" />
                              回答する
                            </button>
                          ) : (
                            <>
                              <Button
                                className="flex-1 gap-2 min-h-[48px] touch-manipulation"
                                variant="destructive"
                                onClick={() => speech.stopListening()}
                              >
                                <Square className="w-4 h-4" />
                                録音停止
                              </Button>
                              <Button
                                className="flex-1 gap-2 min-h-[48px] touch-manipulation"
                                onClick={() => handleSubmitAnswer()}
                                disabled={
                                  !speech.transcript.trim() || isProcessing
                                }
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                送信
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Evaluating */}
            {phase === "evaluating" && (
              <motion.div
                key="evaluating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card>
                  <CardContent className="pt-6 flex flex-col items-center gap-3 py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      AIが回答を分析しています...
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Feedback */}
            {phase === "feedback" && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {error ? (
                  <Card>
                    <CardContent className="pt-6 text-center space-y-3">
                      <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto" />
                      <p className="text-sm text-muted-foreground">{error}</p>
                    </CardContent>
                  </Card>
                ) : evaluation ? (
                  <Card>
                    <CardContent className="pt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold">
                          ワンポイントアドバイス
                        </p>
                        <Badge
                          variant="outline"
                          className="text-sm font-bold"
                          style={{
                            borderColor:
                              evaluation.score >= 80
                                ? "#22c55e"
                                : evaluation.score >= 60
                                  ? "#3b82f6"
                                  : "#f97316",
                            color:
                              evaluation.score >= 80
                                ? "#22c55e"
                                : evaluation.score >= 60
                                  ? "#3b82f6"
                                  : "#f97316",
                          }}
                        >
                          {evaluation.score}/100
                        </Badge>
                      </div>

                      {evaluation.goodPoints.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-600 mb-1">
                            良い点
                          </p>
                          <ul className="space-y-0.5">
                            {evaluation.goodPoints.map((p, i) => (
                              <li
                                key={i}
                                className="text-sm text-muted-foreground flex items-start gap-1.5"
                              >
                                <span className="text-green-500 mt-0.5 flex-shrink-0">
                                  +
                                </span>
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {evaluation.improvementPoints.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-orange-600 mb-1">
                            改善ポイント
                          </p>
                          <ul className="space-y-0.5">
                            {evaluation.improvementPoints.map((p, i) => (
                              <li
                                key={i}
                                className="text-sm text-muted-foreground flex items-start gap-1.5"
                              >
                                <span className="text-orange-500 mt-0.5 flex-shrink-0">
                                  -
                                </span>
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground border-t pt-3">
                        {evaluation.shortFeedback}
                      </p>
                    </CardContent>
                  </Card>
                ) : null}

                <button
                  className="w-full py-4 rounded-xl text-lg font-bold bg-gradient-to-r from-indigo-500 to-cyan-500 text-white active:scale-[0.98] transition-transform touch-manipulation disabled:opacity-50"
                  onClick={handleNextQuestion}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      読み込み中...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      次の質問へ
                      <ChevronRight className="w-5 h-5" />
                    </span>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom controls */}
          {phase !== "evaluating" && phase !== "complete" && (
            <div className="flex gap-3 flex-shrink-0 pb-2">
              <Button
                variant="outline"
                className="gap-1.5 min-h-[48px] touch-manipulation"
                onClick={handleSkip}
                disabled={phase === "speaking-ai" || isProcessing}
              >
                <SkipForward className="w-3.5 h-3.5" />
                スキップ
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 ml-auto min-h-[48px] touch-manipulation"
                onClick={handleEndEarly}
              >
                <Square className="w-3.5 h-3.5" />
                面接を終了
              </Button>
            </div>
          )}

          {/* Browser warning */}
          {!speech.isSupported && (
            <p className="text-xs text-muted-foreground text-center flex-shrink-0">
              お使いのブラウザは音声認識に対応していません。テキスト入力モードで面接を進行します。
            </p>
          )}
        </div>
      </main>
    </PageTransition>
  );
}

// ---------- Wrapper with Suspense ----------
export default function MockInterviewSessionPage() {
  return (
    <Suspense
      fallback={
        <main className="relative z-10 min-h-[100dvh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <MockInterviewSession />
    </Suspense>
  );
}
