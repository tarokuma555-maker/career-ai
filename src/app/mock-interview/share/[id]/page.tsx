"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mic,
  Share2,
  LinkIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import PageTransition from "@/components/PageTransition";
import type { MockInterviewSession } from "@/lib/mock-interview-types";

// ---------- Circular Score ----------
function CircularScore({ score }: { score: number }) {
  const size = 140;
  const radius = size * 0.35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" style={{ width: size, height: size }} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="share-score-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth="10" strokeLinecap="round"
          stroke="url(#share-score-grad)"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--accent-blue)]">{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// ---------- Score Bar ----------
function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <Progress value={score} className="h-2" />
    </div>
  );
}

// ---------- Question Review ----------
function QuestionReview({ answer, index }: {
  answer: { question: string; answer: string; evaluation: { score: number; goodPoints: string[]; improvementPoints: string[]; shortFeedback: string }; answerDuration: number };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = answer.evaluation.score >= 80 ? "#22c55e" : answer.evaluation.score >= 60 ? "#3b82f6" : "#f97316";

  return (
    <Card>
      <button className="w-full text-left p-4 flex items-start justify-between gap-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="flex-shrink-0">Q{index + 1}</Badge>
            <span className="text-sm font-medium truncate">{answer.question}</span>
          </div>
          <Badge variant="outline" className="text-xs" style={{ borderColor: scoreColor, color: scoreColor }}>
            {answer.evaluation.score}/100
          </Badge>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 flex-shrink-0 mt-1" />}
      </button>
      {expanded && (
        <CardContent className="pt-0 space-y-3 border-t">
          <div>
            <p className="text-xs font-medium mb-1">回答（{answer.answerDuration}秒）</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{answer.answer}</p>
          </div>
          {answer.evaluation.goodPoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> 良い点</p>
              <ul className="space-y-0.5">
                {answer.evaluation.goodPoints.map((p, i) => <li key={i} className="text-sm text-muted-foreground">+ {p}</li>)}
              </ul>
            </div>
          )}
          {answer.evaluation.improvementPoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-orange-600 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> 改善ポイント</p>
              <ul className="space-y-0.5">
                {answer.evaluation.improvementPoints.map((p, i) => <li key={i} className="text-sm text-muted-foreground">- {p}</li>)}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted-foreground border-t pt-2">{answer.evaluation.shortFeedback}</p>
        </CardContent>
      )}
    </Card>
  );
}

// ---------- Main Page ----------
export default function SharedMockInterviewPage() {
  const params = useParams();
  const shareId = params.id as string;

  const [session, setSession] = useState<MockInterviewSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/mock-interview/summary?id=${encodeURIComponent(shareId)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "データの取得に失敗しました。");
          return;
        }
        setSession(data);
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
          <div role="status" aria-label="読み込み中" className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </PageTransition>
    );
  }

  if (error || !session?.summary) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="max-w-md w-full">
              <CardContent className="pt-6 text-center space-y-4">
                <LinkIcon className="w-12 h-12 text-muted-foreground mx-auto" />
                <h1 className="text-lg font-bold font-heading">このリンクは期限切れか、存在しません</h1>
                <p className="text-sm text-muted-foreground">{error || "共有データが見つかりませんでした。"}</p>
                <p className="text-xs text-muted-foreground">共有リンクは作成から90日間有効です。</p>
                <Link href="/mock-interview">
                  <Button className="mt-2">模擬面接を体験する</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </PageTransition>
    );
  }

  const summary = session.summary;
  const SCORE_LABELS: Record<string, string> = {
    content: "内容の具体性",
    logic: "論理的構成",
    communication: "コミュニケーション",
    understanding: "質問理解度",
    enthusiasm: "熱意・意欲",
  };

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-center mb-3">
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <Share2 className="w-3.5 h-3.5" />
                共有された模擬面接結果です
              </Badge>
            </div>
            <h1 className="text-2xl font-bold flex items-center justify-center gap-2 mb-2">
              <Mic className="w-6 h-6 text-primary" />
              模擬面接 総合評価
            </h1>
            <div className="flex justify-center gap-2">
              <Badge variant="outline">{session.settings.industry}</Badge>
              <Badge variant="outline">{session.settings.position}</Badge>
            </div>
          </motion.div>

          {/* Total Score */}
          <Card>
            <CardContent className="pt-6 flex flex-col items-center gap-3">
              <CircularScore score={summary.totalScore} />
              <Badge className="text-lg px-4 py-1">{summary.grade}</Badge>
              <p className="text-sm text-muted-foreground">{summary.passLikelihood}</p>
            </CardContent>
          </Card>

          {/* Detail Scores */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">詳細スコア</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(summary.overallScores).map(([key, value]) => (
                <ScoreBar key={key} label={SCORE_LABELS[key] || key} score={value} />
              ))}
            </CardContent>
          </Card>

          {/* Strengths */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                強み
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>{s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Improvements */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                改善ポイント
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {summary.improvements.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5 flex-shrink-0">-</span>{s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Overall Feedback */}
          <Card className="border-[var(--accent-blue)]/20 bg-gradient-to-br from-[var(--accent-blue)]/5 to-[var(--accent-cyan)]/5">
            <CardHeader className="pb-3"><CardTitle className="text-base">総評</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary.overallFeedback}</p>
            </CardContent>
          </Card>

          {/* Per-Question Review */}
          {session.answers.length > 0 && (
            <div>
              <h2 className="text-base font-bold mb-3">各質問の振り返り</h2>
              <div className="space-y-3">
                {session.answers.map((a, i) => (
                  <QuestionReview key={i} answer={a} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <motion.div className="text-center pt-4 pb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Link href="/mock-interview">
              <Button size="lg" className="gap-2">
                <Mic className="w-4 h-4" />
                模擬面接を体験する
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>
    </PageTransition>
  );
}
