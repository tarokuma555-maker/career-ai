"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageTransition from "@/components/PageTransition";
import AIThinking from "@/components/AIThinking";

const STEPS = [
  { label: "あなたの経歴を分析しています...", delay: 2000 },
  { label: "市場トレンドと照合しています...", delay: 3000 },
  { label: "最適なキャリアパスを生成しています...", delay: Infinity },
] as const;

export default function AnalyzingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const apiDone = useRef(false);
  const hasFetched = useRef(false);

  const runAnalysis = useCallback(async () => {
    setError(null);
    setActiveStep(0);
    setCompletedSteps(new Set());
    apiDone.current = false;

    const raw = localStorage.getItem("diagnosisData");
    if (!raw) {
      setError("診断データが見つかりません。診断フォームからやり直してください。");
      return;
    }

    let diagnosisData: unknown;
    try {
      diagnosisData = JSON.parse(raw);
    } catch {
      setError("診断データの読み込みに失敗しました。");
      return;
    }

    const apiPromise = fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(diagnosisData),
    });

    await wait(STEPS[0].delay);
    setCompletedSteps((prev) => new Set(prev).add(0));
    setActiveStep(1);

    await wait(STEPS[1].delay);
    setCompletedSteps((prev) => new Set(prev).add(1));
    setActiveStep(2);

    try {
      const res = await apiPromise;
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `エラーが発生しました (${res.status})`);
        return;
      }

      apiDone.current = true;
      setCompletedSteps((prev) => new Set(prev).add(2));

      localStorage.setItem("analysisResult", JSON.stringify(data));
      await wait(800);
      router.push("/result");
    } catch {
      setError("通信エラーが発生しました。ネットワーク接続を確認してください。");
    }
  }, [router]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    runAnalysis();
  }, [runAnalysis]);

  const handleRetry = () => {
    hasFetched.current = false;
    runAnalysis();
  };

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          className="w-full max-w-md text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* AI Thinking / Error Icon */}
          <div className="mb-8">
            {error ? (
              <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
            ) : (
              <AIThinking text="" />
            )}
          </div>

          <h1 className="font-heading text-2xl font-bold mb-2">
            {error ? "エラーが発生しました" : "AIが分析中です"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {error
              ? "分析を完了できませんでした"
              : "あなたに最適なキャリアプランを作成しています"}
          </p>

          {/* プログレスステップ */}
          <div className="space-y-4 text-left mb-8" role="status" aria-live="polite">
            {STEPS.map((step, i) => {
              const isCompleted = completedSteps.has(i);
              const isActive = i === activeStep && !error;
              const isPending = i > activeStep || (i === activeStep && error);

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-shrink-0">
                    <AnimatePresence mode="wait">
                      {isCompleted ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-7 h-7 rounded-full bg-accent-gradient flex items-center justify-center"
                        >
                          <Check className="w-4 h-4 text-white" />
                        </motion.div>
                      ) : isActive ? (
                        <motion.div
                          key="spinner"
                          className="w-7 h-7 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        />
                      ) : (
                        <div
                          key="pending"
                          className="w-7 h-7 rounded-full border-2 border-muted-foreground/30"
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  <span
                    className={`text-sm ${
                      isCompleted
                        ? "text-foreground font-medium"
                        : isActive
                          ? "text-foreground"
                          : isPending
                            ? "text-muted-foreground"
                            : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* エラー表示 */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
                  {error}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={handleRetry}>もう一度試す</Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/diagnosis")}
                  >
                    診断に戻る
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </PageTransition>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
