"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SkipForward,
  PhoneOff,
  Loader2,
  User,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Keyboard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { MockQuestion, AnswerEvaluation } from "@/lib/mock-interview-types";
import { incrementMockInterview } from "@/lib/chatLimit";
import { useSpeechSynthesisV2 } from "@/hooks/useSpeechSynthesisV2";
import { useSpeechRecognitionV2 } from "@/hooks/useSpeechRecognitionV2";

// ---------- Types ----------
type SessionPhase =
  | "prep"        // Preparation screen (tap to start)
  | "opening"     // AI greeting (TTS)
  | "asking"      // AI asking question (TTS + typing)
  | "waiting"     // Waiting for user to tap mic
  | "answering"   // User speaking (recognition ON)
  | "evaluating"  // AI evaluating answer
  | "feedback"    // Show feedback overlay
  | "closing";    // Finishing up

type InputMode = "voice" | "text";

interface SessionData {
  sessionId: string;
  interviewerProfile: { name: string; role: string };
  openingMessage: string;
  firstQuestion: MockQuestion;
  hasMic?: boolean;
  inputMode?: string;
}

// ---------- Fetch with retry ----------
async function fetchRetry(url: string, opts: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("リクエストに失敗しました");
}

// ---------- Timer ----------
function useTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------- Camera Hook ----------
function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOn(true);
    } catch {
      setIsCameraOn(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraOn(false);
  }, []);

  const toggleCamera = useCallback(() => {
    if (isCameraOn) stopCamera();
    else startCamera();
  }, [isCameraOn, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, isCameraOn, startCamera, stopCamera, toggleCamera };
}

// ---------- Sound Wave ----------
function SoundWave({ light }: { light?: boolean }) {
  return (
    <div className="sound-wave">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bar"
          style={light ? { background: "rgba(255,255,255,0.6)" } : undefined}
        />
      ))}
    </div>
  );
}

// ---------- Main Session Component ----------
function MockInterviewSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";

  // Session state
  const [phase, setPhase] = useState<SessionPhase>("prep");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Input
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [textAnswer, setTextAnswer] = useState("");
  const [useCameraMode, setUseCameraMode] = useState(false);

  // Typing animation
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingCancel = useRef(false);

  // Answer timing
  const answerStartRef = useRef(Date.now());
  const lastSpeechRef = useRef(Date.now());

  // Hooks
  const timerRunning = phase !== "prep" && phase !== "closing";
  const timer = useTimer(timerRunning);
  const tts = useSpeechSynthesisV2();
  const sr = useSpeechRecognitionV2();
  const cam = useCamera();

  // Load session data from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("career-ai-mock-session");
      if (raw) {
        const data = JSON.parse(raw) as SessionData;
        setSessionData(data);
        setCurrentQuestion(data.firstQuestion.question);
        setTotalQuestions(data.firstQuestion?.id ? 8 : 5);
        if (data.inputMode === "text" || data.hasMic === false) {
          setInputMode("text");
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch total question count
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/mock-interview/summary?id=${sessionId}`);
        if (res.ok) {
          const d = await res.json();
          if (d.questions) setTotalQuestions(d.questions.length);
        }
      } catch { /* ignore */ }
    })();
  }, [sessionId]);

  // Check camera preference from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("career-ai-mock-session");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.useCamera) setUseCameraMode(true);
      }
    } catch { /* ignore */ }
  }, []);

  // iOS: lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    };
  }, []);

  // ---------- Typing animation ----------
  const typeText = useCallback(async (text: string) => {
    typingCancel.current = false;
    setIsTyping(true);
    setDisplayedText("");
    for (let i = 0; i < text.length; i++) {
      if (typingCancel.current) break;
      await new Promise((r) => setTimeout(r, 30));
      setDisplayedText(text.slice(0, i + 1));
    }
    setDisplayedText(text);
    setIsTyping(false);
  }, []);

  // ---------- Show question with TTS + typing ----------
  const showQuestionWithSpeech = useCallback(
    async (text: string) => {
      const typingDone = typeText(text);

      if (tts.isSupported) {
        const spoken = await tts.speak(text);
        if (!spoken) {
          // TTS failed, just wait for typing
          await typingDone;
        }
      }
      await typingDone;
    },
    [tts, typeText],
  );

  // ---------- Navigate to result ----------
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

  // ---------- Start interview (called from prep screen tap) ----------
  const handleStartInterview = useCallback(async () => {
    if (!sessionData) return;

    // Activate TTS in user gesture context
    tts.activate();

    // Start camera if chosen
    if (useCameraMode) {
      await cam.startCamera();
    }

    setPhase("opening");

    // Speak opening message
    if (tts.isSupported) {
      await tts.speak(sessionData.openingMessage);
    } else {
      await typeText(sessionData.openingMessage);
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Move to first question
    setPhase("asking");
    await showQuestionWithSpeech(sessionData.firstQuestion.question);
    setPhase("waiting");
    answerStartRef.current = Date.now();
  }, [sessionData, tts, cam, useCameraMode, typeText, showQuestionWithSpeech]);

  // ---------- Start answering (mic tap) ----------
  const handleStartAnswering = useCallback(() => {
    if (inputMode === "voice") {
      sr.startListening();
    }
    setPhase("answering");
    answerStartRef.current = Date.now();
    lastSpeechRef.current = Date.now();
  }, [inputMode, sr]);

  // ---------- Stop answering ----------
  const handleStopAnswering = useCallback(async () => {
    if (inputMode === "voice") sr.stopListening();

    const answerText = inputMode === "voice" ? sr.getTranscript() : textAnswer;

    if (!answerText.trim()) {
      alert("回答が空です。もう一度お話しください。");
      setPhase("waiting");
      return;
    }

    setPhase("evaluating");
    setIsProcessing(true);

    const duration = Math.round((Date.now() - answerStartRef.current) / 1000);

    try {
      const res = await fetchRetry("/api/mock-interview/evaluate", {
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

      const ev = await res.json();
      setEvaluation(ev);
      setEvalError(null);
      setPhase("feedback");
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "評価に失敗しました");
      setPhase("feedback");
    } finally {
      setIsProcessing(false);
    }
  }, [inputMode, sr, textAnswer, sessionId, currentQuestionIndex, currentQuestion]);

  // ---------- Silence detection ----------
  useEffect(() => {
    if (phase === "answering" && inputMode === "voice") {
      lastSpeechRef.current = Date.now();
    }
  }, [sr.transcript, sr.interimText, phase, inputMode]);

  useEffect(() => {
    if (phase !== "answering" || inputMode !== "voice") return;

    const checker = setInterval(() => {
      const silence = Date.now() - lastSpeechRef.current;
      if (silence > 3000 && sr.transcript.length > 0) {
        handleStopAnswering();
      }
    }, 500);

    return () => clearInterval(checker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, inputMode, sr.transcript]);

  // ---------- Next question ----------
  const handleNextQuestion = useCallback(async () => {
    setEvaluation(null);
    setEvalError(null);
    setTextAnswer("");
    setIsProcessing(true);
    typingCancel.current = true;
    setDisplayedText("");

    try {
      const res = await fetchRetry("/api/mock-interview/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, currentQuestionIndex }),
      });

      if (!res.ok) throw new Error("次の質問の取得に失敗しました");
      const data = await res.json();

      if (data.isComplete) {
        await handleFinish();
        return;
      }

      setCurrentQuestionIndex(data.questionIndex);
      setCurrentQuestion(data.question);

      setPhase("asking");
      if (data.transition && tts.isSupported) {
        await tts.speak(data.transition);
      }
      await showQuestionWithSpeech(data.question);
      setPhase("waiting");
      answerStartRef.current = Date.now();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentQuestionIndex, tts, showQuestionWithSpeech]);

  // ---------- Finish ----------
  const handleFinish = useCallback(async () => {
    setPhase("closing");
    tts.stop();
    sr.stopListening();
    cam.stopCamera();
    typingCancel.current = true;

    incrementMockInterview();

    try {
      const res = await fetchRetry("/api/mock-interview/summary", {
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
    } catch { /* continue anyway */ }

    try { localStorage.removeItem("career-ai-mock-progress"); } catch { /* ignore */ }

    navigateToResult(sessionId);
  }, [sessionId, sessionData, tts, sr, cam, navigateToResult]);

  // ---------- Skip ----------
  const handleSkip = useCallback(() => {
    sr.stopListening();
    tts.stop();
    typingCancel.current = true;
    handleNextQuestion();
  }, [sr, tts, handleNextQuestion]);

  // ---------- End early ----------
  const handleEndEarly = useCallback(() => {
    if (confirm("面接を終了しますか？これまでの回答は保存されます。")) {
      handleFinish();
    }
  }, [handleFinish]);

  // ---------- Toggle mic ----------
  const handleMicToggle = useCallback(() => {
    if (phase === "waiting") {
      handleStartAnswering();
    } else if (phase === "answering") {
      handleStopAnswering();
    }
  }, [phase, handleStartAnswering, handleStopAnswering]);

  // ---------- Loading ----------
  if (!sessionData) {
    return (
      <main className="h-[100dvh] flex items-center justify-center bg-[#1a1a2e]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </main>
    );
  }

  const progressPct = totalQuestions > 0
    ? ((currentQuestionIndex + (phase === "feedback" ? 1 : 0)) / totalQuestions) * 100
    : 0;

  // ============================================================
  // Preparation Screen
  // ============================================================
  if (phase === "prep") {
    return (
      <main className="h-[100dvh] flex flex-col bg-[#1a1a2e] text-white pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-6">
          {/* Interviewer info */}
          <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center">
            <User className="w-10 h-10 text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{sessionData.interviewerProfile.name}</p>
            <p className="text-sm text-gray-400">{sessionData.interviewerProfile.role}</p>
          </div>

          <div className="flex gap-4 text-sm text-gray-400">
            <span>質問数: {totalQuestions || "?"}問</span>
            <span>約{totalQuestions === 5 ? "10" : "15"}分</span>
          </div>

          {/* Camera toggle */}
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-600 text-sm touch-manipulation min-h-[44px]"
            onClick={() => setUseCameraMode(!useCameraMode)}
          >
            {useCameraMode ? (
              <><Video className="w-4 h-4 text-green-400" /> カメラ: ON</>
            ) : (
              <><VideoOff className="w-4 h-4 text-gray-400" /> カメラ: OFF</>
            )}
          </button>

          {/* Input mode */}
          {!sr.isSupported && (
            <p className="text-xs text-gray-500">音声認識非対応 — テキスト入力モード</p>
          )}

          {/* Start button */}
          <button
            className="w-full max-w-xs py-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-lg font-bold active:scale-[0.97] transition-transform touch-manipulation"
            onClick={handleStartInterview}
          >
            タップして面接を開始する
          </button>

          <p className="text-xs text-gray-500 text-center">
            静かな環境で実施してください
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // Main Interview UI (Zoom-style)
  // ============================================================
  const isMicActive = phase === "answering" && inputMode === "voice";
  const showFeedbackOverlay = phase === "feedback";

  return (
    <main className="h-[100dvh] flex flex-col bg-[#1a1a2e] text-white overflow-hidden pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 bg-[#111827]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-bold">AI模擬面接</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1 text-gray-300 border-gray-600 text-xs">
              <Clock className="w-3 h-3" />
              {timer}
            </Badge>
            <Badge variant="outline" className="text-gray-300 border-gray-600 text-xs">
              {currentQuestionIndex + 1}/{totalQuestions || "?"}
            </Badge>
          </div>
        </div>
        <Progress value={progressPct} className="h-1 bg-gray-700" />
      </div>

      {/* Video area */}
      <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
        {/* AI Interviewer Panel */}
        <div className="flex-1 rounded-xl bg-[#2d2d44] relative overflow-hidden flex flex-col items-center justify-center px-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mb-2">
            <User className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm font-bold">{sessionData.interviewerProfile.name}</p>
          <p className="text-xs text-gray-400 mb-3">{sessionData.interviewerProfile.role}</p>

          {/* AI question bubble */}
          {(phase === "asking" || phase === "waiting" || phase === "answering" || phase === "evaluating" || phase === "feedback") && (
            <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-2">
              <p className="text-sm leading-relaxed">
                {isTyping ? displayedText : currentQuestion}
                {isTyping && (
                  <span className="inline-block w-0.5 h-3.5 bg-white animate-pulse ml-0.5 align-middle" />
                )}
              </p>
            </div>
          )}

          {/* Opening text */}
          {phase === "opening" && (
            <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-2">
              <p className="text-sm leading-relaxed">
                {displayedText || sessionData.openingMessage}
                {isTyping && (
                  <span className="inline-block w-0.5 h-3.5 bg-white animate-pulse ml-0.5 align-middle" />
                )}
              </p>
            </div>
          )}

          {/* TTS wave */}
          {tts.isSpeaking && (
            <div className="mt-1">
              <SoundWave light />
            </div>
          )}

          {/* Evaluating spinner */}
          {phase === "evaluating" && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              分析中...
            </div>
          )}

          {/* Closing spinner */}
          {phase === "closing" && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              結果を生成中...
            </div>
          )}
        </div>

        {/* User Panel */}
        <div className="h-[35%] min-h-[140px] rounded-xl bg-[#2d2d44] relative overflow-hidden">
          {/* Camera video */}
          {cam.isCameraOn ? (
            <video
              ref={cam.videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-gray-600 flex items-center justify-center">
                <User className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-xs text-gray-500 mt-2">あなた</p>
            </div>
          )}

          {/* Subtitle overlay */}
          {(phase === "answering" || phase === "waiting") && inputMode === "voice" && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2">
              <p className="text-sm text-white truncate">
                {sr.transcript || sr.interimText ? (
                  <>
                    {sr.transcript}
                    {sr.interimText && <span className="text-gray-400">{sr.interimText}</span>}
                  </>
                ) : (
                  phase === "answering" ? (
                    <span className="text-gray-400">話してください...</span>
                  ) : null
                )}
              </p>
            </div>
          )}

          {/* Name tag */}
          <div className="absolute top-2 left-2">
            <span className="text-xs bg-black/50 px-2 py-0.5 rounded">あなた</span>
          </div>

          {/* Mic indicator */}
          {isMicActive && (
            <div className="absolute top-2 right-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Text input area (when in text mode and answering) */}
      {inputMode === "text" && (phase === "waiting" || phase === "answering") && (
        <div className="flex-shrink-0 px-3 pb-2">
          <div className="flex gap-2">
            <textarea
              className="flex-1 p-3 rounded-xl bg-gray-800 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none min-h-[48px] max-h-[100px] text-base resize-none"
              style={{ fontSize: "16px" }}
              placeholder="回答を入力..."
              value={textAnswer}
              onChange={(e) => {
                setTextAnswer(e.target.value);
                if (phase === "waiting") setPhase("answering");
              }}
              rows={2}
            />
            <button
              className="w-14 h-14 rounded-full bg-indigo-500 text-white flex items-center justify-center touch-manipulation disabled:opacity-50 flex-shrink-0"
              disabled={!textAnswer.trim() || isProcessing}
              onClick={() => {
                handleStopAnswering();
              }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="flex-shrink-0 bg-[#111827] px-4 py-3">
        <div className="flex items-center justify-center gap-6">
          {/* Mic button */}
          {inputMode === "voice" ? (
            <button
              className={`w-14 h-14 rounded-full flex flex-col items-center justify-center touch-manipulation transition-colors ${
                isMicActive
                  ? "bg-white text-gray-900"
                  : phase === "waiting"
                    ? "bg-gray-700 text-white"
                    : "bg-gray-800 text-gray-500"
              }`}
              onClick={handleMicToggle}
              disabled={phase !== "waiting" && phase !== "answering"}
            >
              {isMicActive ? <Mic className="w-6 h-6" /> : <MicOff className="w-5 h-5" />}
            </button>
          ) : (
            <button
              className="w-14 h-14 rounded-full bg-gray-800 text-gray-500 flex flex-col items-center justify-center touch-manipulation"
              onClick={() => {
                if (sr.isSupported) setInputMode("voice");
              }}
            >
              <Keyboard className="w-5 h-5" />
            </button>
          )}
          <span className="text-[10px] text-gray-500 absolute mt-16">
            {inputMode === "voice" ? (isMicActive ? "停止" : "マイク") : "テキスト"}
          </span>

          {/* Camera button */}
          <button
            className={`w-14 h-14 rounded-full flex items-center justify-center touch-manipulation ${
              cam.isCameraOn ? "bg-gray-700 text-white" : "bg-gray-800 text-gray-500"
            }`}
            onClick={cam.toggleCamera}
          >
            {cam.isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Skip button */}
          <button
            className="w-14 h-14 rounded-full bg-gray-700 text-white flex items-center justify-center touch-manipulation disabled:opacity-50"
            onClick={handleSkip}
            disabled={phase === "evaluating" || phase === "closing" || isProcessing}
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* End button */}
          <button
            className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center touch-manipulation"
            onClick={handleEndEarly}
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Button labels */}
        <div className="flex items-center justify-center gap-6 mt-1">
          {["マイク", "カメラ", "スキップ", "終了"].map((label) => (
            <span key={label} className="w-14 text-center text-[10px] text-gray-500">
              {label}
            </span>
          ))}
        </div>

        {/* Input mode toggle */}
        {sr.isSupported && (
          <button
            className="w-full text-center text-xs text-gray-500 underline mt-2 touch-manipulation min-h-[32px]"
            onClick={() => setInputMode((p) => (p === "voice" ? "text" : "voice"))}
          >
            {inputMode === "voice" ? "テキストで回答する" : "音声で回答する"}
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* Feedback Overlay */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showFeedbackOverlay && (
          <motion.div
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md bg-[#1e1e36] rounded-2xl p-5 space-y-4 max-h-[80dvh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              {evalError ? (
                <div className="text-center space-y-3">
                  <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto" />
                  <p className="text-sm text-gray-300">{evalError}</p>
                </div>
              ) : evaluation ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">ワンポイントアドバイス</p>
                    <span
                      className="text-sm font-bold px-3 py-1 rounded-full"
                      style={{
                        backgroundColor:
                          evaluation.score >= 80
                            ? "rgba(34,197,94,0.2)"
                            : evaluation.score >= 60
                              ? "rgba(59,130,246,0.2)"
                              : "rgba(249,115,22,0.2)",
                        color:
                          evaluation.score >= 80
                            ? "#22c55e"
                            : evaluation.score >= 60
                              ? "#3b82f6"
                              : "#f97316",
                      }}
                    >
                      {evaluation.score}/100
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all"
                      style={{ width: `${evaluation.score}%` }}
                    />
                  </div>

                  {evaluation.goodPoints.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-400 mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 良い点
                      </p>
                      <ul className="space-y-0.5">
                        {evaluation.goodPoints.map((p, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-1.5">
                            <span className="text-green-400 mt-0.5 flex-shrink-0">+</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evaluation.improvementPoints.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-orange-400 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> 改善ポイント
                      </p>
                      <ul className="space-y-0.5">
                        {evaluation.improvementPoints.map((p, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-1.5">
                            <span className="text-orange-400 mt-0.5 flex-shrink-0">-</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-sm text-gray-400 border-t border-gray-700 pt-3">
                    {evaluation.shortFeedback}
                  </p>
                </>
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
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ---------- Wrapper with Suspense ----------
export default function MockInterviewSessionPage() {
  return (
    <Suspense
      fallback={
        <main className="h-[100dvh] flex items-center justify-center bg-[#1a1a2e]">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </main>
      }
    >
      <MockInterviewSession />
    </Suspense>
  );
}
