"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Briefcase, DollarSign, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalysisResult } from "@/lib/types";
import PageTransition from "@/components/PageTransition";
import { LineIcon } from "@/components/LineShareButton";
import { openLineShare } from "@/lib/lineShare";

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [diag, setDiag] = useState<Record<string, any> | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const raw = localStorage.getItem("analysisResult");
    if (!raw) { router.replace("/diagnosis"); return; }
    try { setResult(JSON.parse(raw)); } catch { router.replace("/diagnosis"); }
    try {
      const diagRaw = localStorage.getItem("diagnosisData");
      if (diagRaw) setDiag(JSON.parse(diagRaw));
    } catch { /* ignore */ }
  }, [router]);

  const handleLineCTA = useCallback(async () => {
    try {
      const diagnosisId = localStorage.getItem("diagnosisId");
      const adminUrl = diagnosisId
        ? `${window.location.origin}/admin/result/${diagnosisId}`
        : undefined;
      const toast = await openLineShare("result", { resultShareUrl: adminUrl });
      setToastMessage(toast);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "共有に失敗しました");
    }
  }, []);

  // ローディング
  if (!result) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen py-10 px-4">
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center animate-pulse space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted mx-auto" />
              <div className="h-8 w-48 bg-muted rounded mx-auto" />
              <div className="h-4 w-64 bg-muted rounded mx-auto" />
            </div>
          </div>
        </main>
      </PageTransition>
    );
  }

  const mainPath = result.career_paths[0];
  const jobType = diag?.jobType === "その他" && diag?.jobTypeOther
    ? diag.jobTypeOther
    : diag?.jobType ?? "あなたの職種";
  const salaryMin = mainPath?.salary_range?.min ?? 0;
  const salaryMax = mainPath?.salary_range?.max ?? 0;
  const salaryUnit = mainPath?.salary_range?.unit ?? "万円";

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-md mx-auto space-y-8">

          {/* ヘッダー */}
          <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold font-heading mb-1 bg-accent-gradient bg-clip-text text-transparent">
              診断結果
            </h1>
            <p className="text-sm text-muted-foreground">AIがあなたの情報をもとに分析しました</p>
          </motion.div>

          {/* メインカード: 職種と平均年収 */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="pt-8 pb-8 space-y-6">
                {/* 職種 */}
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-accent-gradient flex items-center justify-center mx-auto mb-3">
                    <Briefcase className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">あなたの職種</p>
                  <h2 className="text-2xl font-bold font-heading">{jobType}</h2>
                </div>

                {/* 区切り線 */}
                <div className="border-t border-dashed" />

                {/* 平均年収 */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <p className="text-sm text-muted-foreground">平均年収</p>
                  </div>
                  <p className="text-4xl font-bold font-heading bg-accent-gradient bg-clip-text text-transparent">
                    {salaryMin}〜{salaryMax}
                    <span className="text-lg ml-1">{salaryUnit}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* LINE CTA */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <button
              onClick={handleLineCTA}
              className="block w-full rounded-xl px-6 py-5 text-white transition-all hover:brightness-90 hover:-translate-y-0.5 text-left cursor-pointer"
              style={{ backgroundColor: "#06C755" }}
            >
              <div className="flex items-center gap-4">
                <LineIcon className="w-10 h-10 flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold leading-snug">プロに相談してみる</p>
                  <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>LINEで無料サポートが受けられます</p>
                </div>
                <ExternalLink className="w-5 h-5 flex-shrink-0 ml-auto opacity-70" />
              </div>
            </button>
          </motion.div>

          {/* 自己分析CTA */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Link
              href={`/self-analysis?diagnosisId=${localStorage.getItem("diagnosisId") || ""}`}
              className="block"
            >
              <Card className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">もっと詳しく自己分析する</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        約35問のアンケートでより詳しいキャリアプランを作成します
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

        </div>

        {/* Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-lg text-sm max-w-[90vw] text-center"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PageTransition>
  );
}
