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

interface SessionData {
  sessionId: string;
  interviewerProfile: { name: string; role: string };
  openingMessage: string;
  firstQuestion: MockQuestion;
}

// ---------- Sound Wave ----------
function SoundWave() {
  return (
    <div className="sound-wave">
      {[...Array(5)].map((_, i) => <div key={i} className="bar" />)}
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

// ---------- Speech Recognition Hook ----------
function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "ja-JP";
      recognition.continuous = true;
      recognition.interimResults = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        setTranscript(fullTranscript);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          alert("マイクの使用が許可されていません。\nブラウザの設定からマイクを許可してください。");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      setTranscript("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        // Already started
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return { transcript, isListening, isSupported, startListening, stopListening, setTranscript };
}

// ---------- Speech Synthesis Hook ----------
function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("speechSynthesis" in window);
    // Preload voices
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const japaneseVoice = voices.find(v => v.lang.startsWith("ja"));
      if (japaneseVoice) utterance.voice = japaneseVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); resolve(); };
      utterance.onerror = () => { setIsSpeaking(false); resolve(); };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isSupported };
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
  const [currentTransition, setCurrentTransition] = useState<string>("");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const answerStartRef = useRef(Date.now());

  const timer = useTimer();
  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();

  const useTextMode = !speech.isSupported;

  // Load session data
  useEffect(() => {
    try {
      const saved = localStorage.getItem("career-ai-mock-session");
      if (saved) {
        const data = JSON.parse(saved) as SessionData;
        setSessionData(data);
        setCurrentQuestion(data.firstQuestion.question);
        // Get total questions from settings
        const settingsRaw = localStorage.getItem("career-ai-mock-session");
        if (settingsRaw) {
          const s = JSON.parse(settingsRaw);
          setTotalQuestions(s.firstQuestion?.id ? 8 : 5); // Fallback
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Initialize session - speak opening + first question
  useEffect(() => {
    if (sessionData && phase === "init") {
      const init = async () => {
        // Get total question count from the start API response
        try {
          const res = await fetch(`/api/mock-interview/summary?id=${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.questions) setTotalQuestions(data.questions.length);
          }
        } catch { /* ignore - use default */ }

        if (tts.isSupported) {
          await tts.speak(sessionData.openingMessage);
          setPhase("speaking-ai");
          await tts.speak(sessionData.firstQuestion.question);
          setPhase("ready-to-answer");
          answerStartRef.current = Date.now();
        } else {
          setPhase("ready-to-answer");
          answerStartRef.current = Date.now();
        }
      };
      init();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData]);

  // Start recording
  const handleStartAnswer = useCallback(() => {
    if (useTextMode) {
      setPhase("listening");
      answerStartRef.current = Date.now();
      return;
    }
    speech.startListening();
    setPhase("listening");
    answerStartRef.current = Date.now();
  }, [useTextMode, speech]);

  // Submit answer
  const handleSubmitAnswer = useCallback(async () => {
    const answerText = useTextMode ? textInput : speech.transcript;
    if (!answerText.trim()) {
      alert("回答が空です。もう一度お話しください。");
      return;
    }

    if (!useTextMode) speech.stopListening();
    setPhase("evaluating");

    const duration = Math.round((Date.now() - answerStartRef.current) / 1000);

    try {
      const res = await fetch("/api/mock-interview/evaluate", {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "評価に失敗しました");
      setPhase("feedback");
    }
  }, [useTextMode, textInput, speech, sessionId, currentQuestionIndex, currentQuestion]);

  // Next question
  const handleNextQuestion = useCallback(async () => {
    setEvaluation(null);
    setError(null);
    speech.setTranscript("");
    setTextInput("");

    try {
      const res = await fetch("/api/mock-interview/next", {
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
      setCurrentTransition(data.transition || "");

      if (tts.isSupported) {
        setPhase("speaking-ai");
        if (data.transition) await tts.speak(data.transition);
        await tts.speak(data.question);
        setPhase("ready-to-answer");
        answerStartRef.current = Date.now();
      } else {
        setPhase("ready-to-answer");
        answerStartRef.current = Date.now();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentQuestionIndex, speech, tts]);

  // Skip question
  const handleSkip = useCallback(() => {
    if (speech.isListening) speech.stopListening();
    tts.stop();
    handleNextQuestion();
  }, [speech, tts, handleNextQuestion]);

  // Finish interview
  const handleFinish = useCallback(async () => {
    tts.stop();
    if (speech.isListening) speech.stopListening();

    // Increment usage
    incrementMockInterview();

    try {
      const res = await fetch("/api/mock-interview/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (res.ok) {
        const summary = await res.json();
        localStorage.setItem("career-ai-mock-result", JSON.stringify({
          sessionId,
          summary,
          settings: sessionData?.interviewerProfile,
        }));
      }
    } catch { /* continue to result page anyway */ }

    router.push(`/mock-interview/result?sessionId=${sessionId}`);
  }, [sessionId, sessionData, speech, tts, router]);

  // End interview early
  const handleEndEarly = useCallback(() => {
    if (confirm("面接を終了しますか？これまでの回答は保存されます。")) {
      handleFinish();
    }
  }, [handleFinish]);

  if (!sessionData) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </PageTransition>
    );
  }

  const progressPercent = totalQuestions > 0
    ? ((currentQuestionIndex + (phase === "feedback" ? 1 : 0)) / totalQuestions) * 100
    : 0;

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-6 px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
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
          <Progress value={progressPercent} className="h-2" />

          {/* Interviewer Card */}
          <Card className="overflow-hidden">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">{sessionData.interviewerProfile.name}</p>
                  <p className="text-xs text-muted-foreground">{sessionData.interviewerProfile.role}</p>
                </div>
              </div>

              {/* AI speaking animation */}
              {(phase === "speaking-ai" || tts.isSpeaking) && (
                <div className="flex justify-center py-2">
                  <SoundWave />
                </div>
              )}

              {/* Current question */}
              {currentTransition && phase !== "speaking-ai" && (
                <p className="text-sm text-muted-foreground italic">{currentTransition}</p>
              )}
              <p className="text-base font-medium leading-relaxed">
                &ldquo;{currentQuestion}&rdquo;
              </p>
            </CardContent>
          </Card>

          {/* Answer Area */}
          <AnimatePresence mode="wait">
            {/* Listening / Text Input */}
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
                    <p className="text-sm font-medium">あなたの回答</p>

                    {useTextMode ? (
                      /* Text fallback */
                      <div className="space-y-3">
                        <Textarea
                          placeholder="回答を入力してください..."
                          value={textInput}
                          onChange={e => setTextInput(e.target.value)}
                          rows={5}
                        />
                        <Button
                          className="w-full gap-2"
                          onClick={handleSubmitAnswer}
                          disabled={!textInput.trim()}
                        >
                          <ChevronRight className="w-4 h-4" />
                          回答を送信
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
                          {speech.transcript || (
                            <span className="text-muted-foreground italic">
                              {speech.isListening ? "話してください..." : "ボタンを押して話し始めてください"}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-3">
                          {!speech.isListening ? (
                            <Button
                              className="flex-1 gap-2"
                              onClick={handleStartAnswer}
                              disabled={phase !== "ready-to-answer"}
                            >
                              <Mic className="w-4 h-4" />
                              回答する
                            </Button>
                          ) : (
                            <>
                              <Button
                                className="flex-1 gap-2"
                                variant="destructive"
                                onClick={() => { speech.stopListening(); }}
                              >
                                <Square className="w-4 h-4" />
                                録音停止
                              </Button>
                              <Button
                                className="flex-1 gap-2"
                                onClick={handleSubmitAnswer}
                                disabled={!speech.transcript.trim()}
                              >
                                <ChevronRight className="w-4 h-4" />
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
                    <p className="text-sm text-muted-foreground">AIが回答を分析しています...</p>
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
                        <p className="text-sm font-bold">ワンポイントアドバイス</p>
                        <Badge
                          variant="outline"
                          className="text-sm font-bold"
                          style={{
                            borderColor: evaluation.score >= 80 ? "#22c55e" : evaluation.score >= 60 ? "#3b82f6" : "#f97316",
                            color: evaluation.score >= 80 ? "#22c55e" : evaluation.score >= 60 ? "#3b82f6" : "#f97316",
                          }}
                        >
                          {evaluation.score}/100
                        </Badge>
                      </div>

                      {evaluation.goodPoints.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-600 mb-1">良い点</p>
                          <ul className="space-y-0.5">
                            {evaluation.goodPoints.map((p, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                                <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {evaluation.improvementPoints.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-orange-600 mb-1">改善ポイント</p>
                          <ul className="space-y-0.5">
                            {evaluation.improvementPoints.map((p, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                                <span className="text-orange-500 mt-0.5 flex-shrink-0">-</span>
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

                <Button className="w-full gap-2" onClick={handleNextQuestion}>
                  <ChevronRight className="w-4 h-4" />
                  次の質問へ
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom controls */}
          {phase !== "evaluating" && phase !== "complete" && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleSkip}
                disabled={phase === "speaking-ai"}
              >
                <SkipForward className="w-3.5 h-3.5" />
                スキップ
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 ml-auto"
                onClick={handleEndEarly}
              >
                <Square className="w-3.5 h-3.5" />
                面接を終了
              </Button>
            </div>
          )}

          {/* Unsupported browser warning */}
          {useTextMode && (
            <p className="text-xs text-muted-foreground text-center">
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
    <Suspense fallback={
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <MockInterviewSession />
    </Suspense>
  );
}
