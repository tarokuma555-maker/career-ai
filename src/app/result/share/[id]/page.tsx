"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Share2, LinkIcon, Briefcase, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageTransition from "@/components/PageTransition";
import type { AnalysisResult } from "@/lib/types";

export default function SharedResultPage() {
  const params = useParams();
  const shareId = params.id as string;

  const [result, setResult] = useState<AnalysisResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [diag, setDiag] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || "データの取得に失敗しました。"); return; }
        setResult(data.analysisResult);
        if (data.diagnosisData) setDiag(data.diagnosisData);
      } catch {
        setError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }
    if (shareId) fetchData();
  }, [shareId]);

  if (loading) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center">
          <div role="status" className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </PageTransition>
    );
  }

  if (error || !result) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <LinkIcon className="w-12 h-12 text-muted-foreground mx-auto" />
              <h1 className="text-lg font-bold">このリンクは期限切れか、存在しません</h1>
              <p className="text-sm text-muted-foreground">{error || "共有データが見つかりませんでした。"}</p>
              <Link href="/diagnosis"><Button className="mt-2">自分もキャリア診断をする</Button></Link>
            </CardContent>
          </Card>
        </main>
      </PageTransition>
    );
  }

  const mainPath = result.career_paths[0];
  const jobType = diag?.jobType === "その他" && diag?.jobTypeOther
    ? diag.jobTypeOther
    : diag?.jobType ?? "職種";
  const salaryMin = mainPath?.salary_range?.min ?? 0;
  const salaryMax = mainPath?.salary_range?.max ?? 0;
  const salaryUnit = mainPath?.salary_range?.unit ?? "万円";

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-md mx-auto space-y-8">

          {/* ヘッダー */}
          <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 mb-3">
              <Share2 className="w-3.5 h-3.5" />
              共有された結果です
            </Badge>
            <h1 className="text-2xl font-bold font-heading bg-accent-gradient bg-clip-text text-transparent">
              診断結果
            </h1>
          </motion.div>

          {/* メインカード: 職種と平均年収 */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="pt-8 pb-8 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-accent-gradient flex items-center justify-center mx-auto mb-3">
                    <Briefcase className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">職種</p>
                  <h2 className="text-2xl font-bold font-heading">{jobType}</h2>
                </div>
                <div className="border-t border-dashed" />
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

          {/* CTA */}
          <motion.div className="text-center pt-4 pb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Link href="/diagnosis">
              <Button size="lg">自分もキャリア診断をする</Button>
            </Link>
          </motion.div>
        </div>
      </main>
    </PageTransition>
  );
}
