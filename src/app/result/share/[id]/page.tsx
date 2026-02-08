"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Sparkles,
  Share2,
  LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageTransition from "@/components/PageTransition";
import type { AnalysisResult, CareerPath } from "@/lib/types";

// ---------- 円形スコア ----------
function CircularScore({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="score-grad-share" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-muted" />
        <motion.circle
          cx="50" cy="50" r={radius} fill="none" strokeWidth="8" strokeLinecap="round"
          stroke="url(#score-grad-share)"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-[var(--accent-blue)]">{score}</span>
        <span className="text-[10px] text-muted-foreground">適合度</span>
      </div>
    </div>
  );
}

// ---------- キャリアパスカード（閲覧専用） ----------
function SharedCareerPathCard({ path, index }: { path: CareerPath; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4 }}
    >
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            <CircularScore score={path.match_score} />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl mb-1 leading-tight">{path.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{path.description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 年収レンジ */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>年収レンジ</span>
              <span className="font-medium text-foreground">
                {path.salary_range.min}〜{path.salary_range.max}{path.salary_range.unit}
              </span>
            </div>
          </div>

          {/* 推薦理由 */}
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              推薦理由
            </div>
            <p className="text-sm text-muted-foreground">{path.why_recommended}</p>
          </div>

          {/* 必要スキル */}
          <div>
            <p className="text-sm font-medium mb-2">必要スキル</p>
            <div className="flex flex-wrap gap-1.5">
              {path.required_skills.map((skill) => (
                <Badge key={skill} variant="secondary">{skill}</Badge>
              ))}
            </div>
          </div>

          {/* ロードマップ */}
          <div>
            <p className="text-sm font-medium mb-3">ロードマップ</p>
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-border" />
              {path.roadmap.map((item) => (
                <div key={item.step} className="relative">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-accent-gradient text-white text-xs flex items-center justify-center font-medium">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary">{item.period}</p>
                    <p className="text-sm text-muted-foreground">{item.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* メリット / デメリット */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                <ThumbsUp className="w-4 h-4 text-green-500" />
                メリット
              </div>
              <ul className="space-y-1">
                {path.pros.map((pro, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-green-500 mt-1 flex-shrink-0">●</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                <ThumbsDown className="w-4 h-4 text-orange-500" />
                デメリット
              </div>
              <ul className="space-y-1">
                {path.cons.map((con, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-orange-500 mt-1 flex-shrink-0">●</span>
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* リスク */}
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              考慮すべきリスク
            </div>
            <p className="text-sm text-muted-foreground">{path.risks}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------- メインページ ----------
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

        if (!res.ok) {
          setError(data.error || "データの取得に失敗しました。");
          return;
        }

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

  // ローディング
  if (loading) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center">
          <div role="status" aria-label="読み込み中" className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </PageTransition>
    );
  }

  // エラー
  if (error || !result) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="max-w-md w-full">
              <CardContent className="pt-6 text-center space-y-4">
                <LinkIcon className="w-12 h-12 text-muted-foreground mx-auto" />
                <h1 className="text-lg font-bold font-heading">
                  このリンクは期限切れか、存在しません
                </h1>
                <p className="text-sm text-muted-foreground">
                  {error || "共有データが見つかりませんでした。"}
                </p>
                <p className="text-xs text-muted-foreground">
                  共有リンクは作成から30日間有効です。
                </p>
                <Link href="/diagnosis">
                  <Button className="mt-2">自分もキャリア診断をする</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <main className="relative z-10 min-h-screen py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ヘッダー */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-center mb-3">
            <Badge variant="outline" className="gap-1.5 px-3 py-1">
              <Share2 className="w-3.5 h-3.5" />
              共有された結果です
            </Badge>
          </div>
          <h1 className="text-3xl font-bold font-heading mb-2">キャリアプラン</h1>
          {diag && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {diag.ageRange && <Badge variant="outline">{diag.ageRange}</Badge>}
              {diag.jobType && (
                <Badge variant="outline">
                  {diag.jobType === "その他" ? diag.jobTypeOther : diag.jobType}
                </Badge>
              )}
              {diag.industry && <Badge variant="outline">{diag.industry}</Badge>}
              {diag.experienceYears && (
                <Badge variant="outline">{diag.experienceYears}</Badge>
              )}
            </div>
          )}
        </motion.div>

        {/* キャリアパスカード */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">おすすめのキャリアパス</h2>
          </div>
          <div className="space-y-6">
            {result.career_paths.map((path, i) => (
              <SharedCareerPathCard key={path.title} path={path} index={i} />
            ))}
          </div>
        </section>

        {/* 総合アドバイス */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-[var(--accent-blue)]/20 bg-gradient-to-br from-[var(--accent-blue)]/5 to-[var(--accent-cyan)]/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AIからのアドバイス
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {result.overall_advice}
              </p>
            </CardContent>
          </Card>
        </motion.section>

        {/* CTA */}
        <motion.div
          className="text-center pt-4 pb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
        >
          <Link href="/diagnosis">
            <Button size="lg">自分もキャリア診断をする</Button>
          </Link>
        </motion.div>
      </div>
    </main>
    </PageTransition>
  );
}
