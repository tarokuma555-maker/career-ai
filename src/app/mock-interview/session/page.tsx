"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// framer-motion removed: using CSS animations only
import {
  Video,
  VideoOff,
  SkipForward,
  PhoneOff,
  Loader2,
  User,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { MockQuestion, AnswerEvaluation } from "@/lib/mock-interview-types";
import { incrementMockInterview } from "@/lib/chatLimit";
import { useCamera } from "@/hooks/useCamera";

// ---------- Types ----------
type Phase =
  | "ready"
  | "opening"
  | "questioning"
  | "answering"
  | "evaluating"
  | "feedback"
  | "closing";

interface ChatMessage {
  id: string;
  role: "interviewer" | "user" | "system";
  content: string;
  timestamp: number;
  feedback?: {
    score: number;
    goodPoints: string[];
    improvementPoints: string[];
    shortFeedback: string;
  };
}

interface SessionData {
  sessionId: string;
  interviewerProfile: { name: string; role: string };
  openingMessage: string;
  firstQuestion: MockQuestion;
  useCamera?: boolean;
}

const ANSWER_TIME_LIMIT = 120; // seconds

// ---------- Helpers ----------
let _msgCounter = 0;
function msgId() {
  return `m${Date.now()}-${++_msgCounter}`;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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

// ---------- Timer Hook ----------
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

// ---------- Feedback Card ----------
function FeedbackCard({ feedback }: {
  feedback: { score: number; goodPoints: string[]; improvementPoints: string[]; shortFeedback: string };
}) {
  const scoreColor =
    feedback.score >= 80 ? "text-green-400" : feedback.score >= 60 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="bg-gray-800/80 backdrop-blur border border-gray-700 rounded-2xl p-4 my-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-xs font-bold flex items-center gap-1">
          <Target className="w-3 h-3" /> 評価
        </span>
        <span className={`text-2xl font-bold ${scoreColor}`}>{feedback.score}/100</span>
      </div>

      <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${feedback.score}%` }}
        />
      </div>

      {feedback.goodPoints.length > 0 && (
        <div className="mb-3">
          <p className="text-green-400 text-xs font-bold mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 良い点
          </p>
          {feedback.goodPoints.map((p, i) => (
            <p key={i} className="text-gray-300 text-sm ml-4">・{p}</p>
          ))}
        </div>
      )}

      {feedback.improvementPoints.length > 0 && (
        <div className="mb-3">
          <p className="text-yellow-400 text-xs font-bold mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> 改善ポイント
          </p>
          {feedback.improvementPoints.map((p, i) => (
            <p key={i} className="text-gray-300 text-sm ml-4">・{p}</p>
          ))}
        </div>
      )}

      {feedback.shortFeedback && (
        <p className="text-gray-400 text-xs border-t border-gray-700 pt-2 mt-2">{feedback.shortFeedback}</p>
      )}
    </div>
  );
}

// ---------- Typing Dots ----------
function TypingDots() {
  return (
    <div className="flex gap-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
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

  // State
  const [phase, setPhase] = useState<Phase>("ready");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [canAnswer, setCanAnswer] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [remainingTime, setRemainingTime] = useState(ANSWER_TIME_LIMIT);
  const [answerStartTime, setAnswerStartTime] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState("");

  // Refs
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingCancelRef = useRef(false);

  // Hooks
  const timerRunning = phase !== "ready" && phase !== "closing";
  const timer = useTimer(timerRunning);
  const cam = useCamera();

  // ---------- Load session ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem("career-ai-mock-session");
      if (raw) {
        const data = JSON.parse(raw) as SessionData;
        setSessionData(data);
        setCurrentQuestion(data.firstQuestion.question);
        setTotalQuestions(data.firstQuestion?.id ? 8 : 5);
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

  // Auto-scroll
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  // Answer countdown
  useEffect(() => {
    if (!canAnswer || !answerStartTime) return;
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - answerStartTime) / 1000);
      const remaining = Math.max(0, ANSWER_TIME_LIMIT - elapsed);
      setRemainingTime(remaining);

      if (remaining <= 0) {
        clearInterval(iv);
        // handled below
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [canAnswer, answerStartTime]);

  // Time's up handler
  useEffect(() => {
    if (remainingTime > 0 || !canAnswer) return;
    if (answerText.trim()) {
      handleSubmitAnswer();
    } else {
      handleSkipQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingTime, canAnswer]);

  // Reset timer each question
  useEffect(() => {
    setRemainingTime(ANSWER_TIME_LIMIT);
  }, [currentQuestionIndex]);

  // ---------- Add interviewer message with typing animation ----------
  const addInterviewerMessage = useCallback(
    async (text: string) => {
      const id = msgId();
      typingCancelRef.current = false;
      setIsAiTyping(true);

      // Show typing dots for 800ms
      await new Promise((r) => setTimeout(r, 800));
      if (typingCancelRef.current) { setIsAiTyping(false); return; }

      // Add empty message
      setMessages((prev) => [...prev, { id, role: "interviewer", content: "", timestamp: Date.now() }]);
      setIsAiTyping(false);

      // Type character by character
      for (let i = 0; i < text.length; i++) {
        if (typingCancelRef.current) {
          // Show full text immediately on cancel
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: text } : m)));
          break;
        }
        await new Promise((r) => setTimeout(r, 25));
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: text.slice(0, i + 1) } : m)));
      }
    },
    [],
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

  // ---------- Start interview ----------
  const handleStartInterview = useCallback(async () => {
    if (!sessionData) return;

    // Start camera if configured
    if (sessionData.useCamera) {
      await cam.startCamera();
    }

    setPhase("opening");

    // Opening message
    await addInterviewerMessage(sessionData.openingMessage);

    // First question
    setPhase("questioning");
    await addInterviewerMessage(sessionData.firstQuestion.question);

    setPhase("answering");
    setCanAnswer(true);
    setAnswerStartTime(Date.now());
    textareaRef.current?.focus();
  }, [sessionData, cam, addInterviewerMessage]);

  // ---------- Submit answer ----------
  const handleSubmitAnswer = useCallback(async () => {
    const text = answerText.trim();
    if (!text || isProcessing) return;

    // Add user message
    setMessages((prev) => [...prev, { id: msgId(), role: "user", content: text, timestamp: Date.now() }]);
    setAnswerText("");
    setCanAnswer(false);
    setAnswerStartTime(null);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setPhase("evaluating");
    setIsProcessing(true);
    setIsAiTyping(true);

    const duration = Math.round((Date.now() - (answerStartTime || Date.now())) / 1000);

    try {
      const res = await fetchRetry("/api/mock-interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionIndex: currentQuestionIndex,
          question: currentQuestion,
          answer: text,
          answerDuration: duration,
        }),
      });

      setIsAiTyping(false);

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "評価に失敗しました");
      }

      const evaluation: AnswerEvaluation = await res.json();

      // Add feedback as system message
      setMessages((prev) => [
        ...prev,
        {
          id: msgId(),
          role: "system",
          content: "",
          timestamp: Date.now(),
          feedback: {
            score: evaluation.score,
            goodPoints: evaluation.goodPoints,
            improvementPoints: evaluation.improvementPoints,
            shortFeedback: evaluation.shortFeedback,
          },
        },
      ]);

      setPhase("feedback");

      // Wait then move to next question
      await new Promise((r) => setTimeout(r, 1500));
      await handleNextQuestion();
    } catch (err) {
      setIsAiTyping(false);
      // Add error message
      setMessages((prev) => [
        ...prev,
        { id: msgId(), role: "system", content: err instanceof Error ? err.message : "評価に失敗しました", timestamp: Date.now() },
      ]);
      // Still proceed to next question
      await new Promise((r) => setTimeout(r, 1000));
      await handleNextQuestion();
    } finally {
      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerText, isProcessing, sessionId, currentQuestionIndex, currentQuestion, answerStartTime]);

  // ---------- Next question ----------
  const handleNextQuestion = useCallback(async () => {
    typingCancelRef.current = false;

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

      setPhase("questioning");

      // Transition message
      if (data.transition) {
        await addInterviewerMessage(data.transition);
      }

      // Next question
      await addInterviewerMessage(data.question);

      setPhase("answering");
      setCanAnswer(true);
      setAnswerStartTime(Date.now());
      textareaRef.current?.focus();
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: msgId(), role: "system", content: "次の質問の取得に失敗しました。", timestamp: Date.now() },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentQuestionIndex, addInterviewerMessage]);

  // ---------- Finish ----------
  const handleFinish = useCallback(async () => {
    setPhase("closing");
    setCanAnswer(false);
    cam.stopCamera();
    typingCancelRef.current = true;

    await addInterviewerMessage("お疲れ様でした。結果を集計しています...");

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
  }, [sessionId, sessionData, cam, addInterviewerMessage, navigateToResult]);

  // ---------- Skip ----------
  const handleSkipQuestion = useCallback(async () => {
    setCanAnswer(false);
    setAnswerStartTime(null);
    setAnswerText("");
    typingCancelRef.current = true;

    setMessages((prev) => [
      ...prev,
      { id: msgId(), role: "system", content: "この質問をスキップしました。", timestamp: Date.now() },
    ]);

    await new Promise((r) => setTimeout(r, 500));
    await handleNextQuestion();
  }, [handleNextQuestion]);

  // ---------- End early ----------
  const handleEndInterview = useCallback(() => {
    if (confirm("面接を終了しますか？これまでの回答は保存されます。")) {
      handleFinish();
    }
  }, [handleFinish]);

  // ---------- Loading ----------
  if (!sessionData) {
    return (
      <main className="h-[100dvh] flex items-center justify-center bg-[#111827]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </main>
    );
  }

  const interviewerName = sessionData.interviewerProfile.name;
  const progressPct = totalQuestions > 0
    ? ((currentQuestionIndex + (phase === "feedback" || phase === "evaluating" ? 1 : 0)) / totalQuestions) * 100
    : 0;

  // ============================================================
  // Ready Screen
  // ============================================================
  if (phase === "ready") {
    return (
      <main className="h-[100dvh] flex flex-col bg-[#111827] text-white pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-5">
          <Target className="w-10 h-10 text-indigo-400" />
          <h1 className="text-xl font-bold">AI模擬面接</h1>

          {/* Camera preview */}
          <div className="w-full max-w-[280px] aspect-[4/3] bg-gray-800 rounded-xl overflow-hidden relative">
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
                <User className="w-12 h-12 text-gray-500 mb-2" />
                <p className="text-gray-500 text-sm">カメラプレビュー</p>
              </div>
            )}
          </div>

          {/* Camera toggle */}
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-600 text-sm touch-manipulation min-h-[44px]"
            onClick={cam.toggleCamera}
          >
            {cam.isCameraOn ? (
              <><Video className="w-4 h-4 text-green-400" /> カメラON</>
            ) : (
              <><VideoOff className="w-4 h-4 text-gray-400" /> カメラOFF</>
            )}
          </button>
          {cam.cameraError && <p className="text-red-400 text-xs">{cam.cameraError}</p>}

          {/* Interviewer info */}
          <div className="text-center text-sm space-y-1">
            <p className="text-gray-400">面接官</p>
            <p className="font-bold">{interviewerName}</p>
            <p className="text-gray-400 text-xs">{sessionData.interviewerProfile.role}</p>
          </div>

          <div className="flex gap-4 text-xs text-gray-500">
            <span>質問数: {totalQuestions || "?"}問</span>
            <span>制限時間: 各2分</span>
          </div>

          {/* Start button */}
          <button
            className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-lg font-bold active:scale-[0.97] transition-transform touch-manipulation"
            onClick={handleStartInterview}
          >
            面接を開始する
          </button>

          <p className="text-xs text-gray-500 text-center leading-relaxed">
            テキストで回答する形式です。<br />面接官の質問に文章で回答してください。
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // Main Interview UI
  // ============================================================
  return (
    <main className="h-[100dvh] flex flex-col bg-[#0f1117] text-white overflow-hidden">
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
      <div className="flex-shrink-0 flex gap-2 p-2 bg-gray-900">
        {/* AI Interviewer */}
        <div className="flex-1 bg-gray-800 rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px]">
          <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center mb-1.5">
            <User className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-white font-bold text-xs">{interviewerName}</p>
          <p className="text-gray-400 text-[10px]">{sessionData.interviewerProfile.role}</p>
          {isAiTyping && (
            <div className="mt-1.5">
              <TypingDots />
            </div>
          )}
        </div>

        {/* User Camera */}
        <div className="w-[120px] bg-gray-800 rounded-xl overflow-hidden relative min-h-[120px]">
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
              <User className="w-8 h-8 text-gray-600 mb-1" />
              <p className="text-gray-500 text-[10px]">カメラOFF</p>
            </div>
          )}
          <button
            className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center touch-manipulation"
            onClick={cam.toggleCamera}
          >
            {cam.isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-950">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "interviewer" ? (
              <div className="flex items-start gap-2 max-w-[85%]">
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] mb-0.5">{interviewerName}</p>
                  <div className="bg-gray-800 text-white p-3 rounded-2xl rounded-tl-none text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              </div>
            ) : msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%]">
                  <div className="bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              </div>
            ) : msg.feedback ? (
              <div className="mx-auto max-w-[90%]">
                <FeedbackCard feedback={msg.feedback} />
              </div>
            ) : (
              <div className="text-center">
                <span className="text-gray-500 text-xs bg-gray-800/50 px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* AI typing indicator */}
        {isAiTyping && (
          <div className="flex items-start gap-2 max-w-[85%]">
            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none">
              <TypingDots />
            </div>
          </div>
        )}

        {/* Closing indicator */}
        {phase === "closing" && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-gray-400 text-sm">結果を集計中...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 bg-gray-900 border-t border-gray-700 px-4 pt-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {/* Timer */}
        {canAnswer && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">
              質問 {currentQuestionIndex + 1}/{totalQuestions}
            </span>
            <span className={`text-sm font-mono ${remainingTime < 30 ? "text-red-400" : "text-gray-300"}`}>
              <Clock className="w-3 h-3 inline mr-1" />
              残り {formatTime(remainingTime)}
            </span>
          </div>
        )}

        {/* Text input + send */}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            className="flex-1 p-3 rounded-xl bg-gray-800 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none text-base leading-relaxed placeholder-gray-500 min-h-[48px] max-h-[150px]"
            style={{ fontSize: "16px" }}
            placeholder={canAnswer ? "回答を入力してください..." : "面接官の質問をお待ちください..."}
            value={answerText}
            onChange={(e) => {
              setAnswerText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleSubmitAnswer();
              }
            }}
            disabled={!canAnswer || isProcessing}
            rows={1}
          />
          <button
            className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform touch-manipulation shrink-0"
            disabled={!answerText.trim() || !canAnswer || isProcessing}
            onClick={handleSubmitAnswer}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Skip / End */}
        <div className="flex justify-between mt-2">
          <button
            className="text-gray-500 text-sm py-2 px-3 min-h-[44px] touch-manipulation disabled:opacity-40"
            onClick={handleSkipQuestion}
            disabled={isProcessing || phase === "closing"}
          >
            <SkipForward className="w-3.5 h-3.5 inline mr-1" />
            スキップ
          </button>
          <button
            className="text-red-400 text-sm py-2 px-3 min-h-[44px] touch-manipulation disabled:opacity-40"
            onClick={handleEndInterview}
            disabled={isProcessing || phase === "closing"}
          >
            <PhoneOff className="w-3.5 h-3.5 inline mr-1" />
            面接を終了
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------- Wrapper with Suspense ----------
export default function MockInterviewSessionPage() {
  return (
    <Suspense
      fallback={
        <main className="h-[100dvh] flex items-center justify-center bg-[#111827]">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </main>
      }
    >
      <MockInterviewSession />
    </Suspense>
  );
}
