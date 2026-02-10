"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Sparkles,
  Share2,
  LinkIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
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

// ---------- スコアの絵文字・ラベル ----------
function getScoreInfo(score: number) {
  if (score >= 80) return { emoji: "😄", label: "とても合ってる！", color: "#22c55e" };
  if (score >= 60) return { emoji: "😊", label: "合ってる！", color: "#3b82f6" };
  if (score >= 40) return { emoji: "🤔", label: "まあまあ", color: "#f59e0b" };
  return { emoji: "💪", label: "チャレンジ！", color: "#f97316" };
}

// ---------- 大きな円形スコア ----------
function BigScore({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const info = getScoreInfo(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
          <motion.circle
            cx="64" cy="64" r={radius} fill="none" strokeWidth="10" strokeLinecap="round"
            stroke={info.color}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeDasharray={circumference}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl">{info.emoji}</span>
          <span className="text-2xl font-bold" style={{ color: info.color }}>{score}</span>
        </div>
      </div>
      <span className="text-sm font-medium" style={{ color: info.color }}>{info.label}</span>
    </div>
  );
}

// ---------- 小さな円形スコア ----------
function SmallScore({ score }: { score: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const info = getScoreInfo(score);

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-muted" />
        <motion.circle
          cx="40" cy="40" r={radius} fill="none" strokeWidth="7" strokeLinecap="round"
          stroke={info.color}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg">{info.emoji}</span>
        <span className="text-sm font-bold" style={{ color: info.color }}>{score}</span>
      </div>
    </div>
  );
}

// ---------- ロードマップアイコン ----------
const STEP_ICONS = ["📚", "🔧", "💼", "🎯", "🚀"];

// ---------- ロードマップタイムライン ----------
function RoadmapTimeline({ roadmap }: { roadmap: CareerPath["roadmap"] }) {
  return (
    <div className="relative pl-8 space-y-4">
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-[var(--accent-blue)] to-[var(--accent-cyan)]" />
      {roadmap.map((item, i) => (
        <div key={item.step} className="relative">
          <div className="absolute -left-8 top-0 w-8 h-8 rounded-full bg-background border-2 border-[var(--accent-blue)] flex items-center justify-center text-base">
            {STEP_ICONS[i] || "📌"}
          </div>
          <div className="bg-muted/50 rounded-lg p-3 ml-2">
            <Badge variant="secondary" className="text-xs mb-1">{item.period}</Badge>
            <p className="text-sm">{item.action}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- いいところ・気をつけること ----------
function ProsCons({ pros, cons, risks }: { pros: string[]; cons: string[]; risks: string }) {
  const warnings = [...cons];
  if (risks) warnings.push(risks);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5 text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          いいところ
        </p>
        <ul className="space-y-1.5">
          {pros.map((pro, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
              {pro}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          気をつけること
        </p>
        <ul className="space-y-1.5">
          {warnings.map((w, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span>
              {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- メインページ ----------
export default function SharedResultPage() {
  const params = useParams();
  const shareId = params.id as string;

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOthers, setExpandedOthers] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || "データの取得に失敗しました。"); return; }
        setResult(data.analysisResult);
      } catch {
        setError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }
    if (shareId) fetchData();
  }, [shareId]);

  const barData = useMemo(() => {
    if (!result) return [];
    const keys = Array.from(new Set([
      ...Object.keys(result.skill_analysis.current_skills),
      ...Object.keys(result.skill_analysis.target_skills),
    ]));
    return keys.map((skill) => ({
      skill,
      いま: result.skill_analysis.current_skills[skill] ?? 0,
      目標: result.skill_analysis.target_skills[skill] ?? 0,
    }));
  }, [result]);

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
  const otherPaths = result.career_paths.slice(1);

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-8">

          {/* ヘッダー */}
          <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 mb-3">
              <Share2 className="w-3.5 h-3.5" />
              共有された結果です
            </Badge>
            <h1 className="text-2xl font-bold font-heading bg-accent-gradient bg-clip-text text-transparent">
              あなたにぴったりのキャリア
            </h1>
          </motion.div>

          {/* メインのキャリアカード */}
          {mainPath && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardContent className="pt-6 space-y-5">
                  <div className="flex flex-col items-center text-center gap-3">
                    <BigScore score={mainPath.match_score} />
                    <div>
                      <Badge className="mb-2">イチオシ</Badge>
                      <h2 className="text-xl font-bold">{mainPath.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{mainPath.description}</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-3">
                    <p className="text-sm font-medium flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                      なぜおすすめ？
                    </p>
                    <p className="text-sm text-muted-foreground">{mainPath.why_recommended}</p>
                  </div>
                  <ProsCons pros={mainPath.pros} cons={mainPath.cons} risks={mainPath.risks} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ロードマップ */}
          {mainPath && (
            <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    やることステップ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RoadmapTimeline roadmap={mainPath.roadmap} />
                </CardContent>
              </Card>
            </motion.section>
          )}

          {/* スキルチャート */}
          {barData.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">スキルチェック</CardTitle>
                  <p className="text-xs text-muted-foreground">いまの力と目標を比べてみよう</p>
                </CardHeader>
                <CardContent>
                  <div className="w-full" style={{ height: Math.max(200, barData.length * 50) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="skill" tick={{ fontSize: 12 }} width={80} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="いま" fill="#4F46E5" radius={[0, 4, 4, 0]} barSize={14} />
                        <Bar dataKey="目標" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.section>
          )}

          {/* ほかのおすすめ */}
          {otherPaths.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                ほかのおすすめ
              </h2>
              <div className="space-y-3">
                {otherPaths.map((path, i) => {
                  const isExpanded = expandedOthers.has(i);
                  return (
                    <Card key={path.title}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <SmallScore score={path.match_score} />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold">{path.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">{path.description}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="sm" className="w-full"
                          onClick={() => {
                            setExpandedOthers((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            });
                          }}
                        >
                          {isExpanded ? <>閉じる <ChevronUp className="w-4 h-4 ml-1" /></> : <>くわしく見る <ChevronDown className="w-4 h-4 ml-1" /></>}
                        </Button>
                        {isExpanded && (
                          <div className="space-y-4">
                            <div className="bg-primary/5 rounded-lg p-3">
                              <p className="text-sm font-medium flex items-center gap-1.5 mb-1">
                                <Sparkles className="w-4 h-4 text-primary" />
                                なぜおすすめ？
                              </p>
                              <p className="text-sm text-muted-foreground">{path.why_recommended}</p>
                            </div>
                            <RoadmapTimeline roadmap={path.roadmap} />
                            <ProsCons pros={path.pros} cons={path.cons} risks={path.risks} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* AIからのアドバイス */}
          <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
            <Card className="border-[var(--accent-blue)]/20 bg-gradient-to-br from-[var(--accent-blue)]/5 to-[var(--accent-cyan)]/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-gradient flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">AIからのアドバイス</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.overall_advice}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* CTA */}
          <motion.div className="text-center pt-4 pb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}>
            <Link href="/diagnosis">
              <Button size="lg">自分もキャリア診断をする</Button>
            </Link>
          </motion.div>
        </div>
      </main>
    </PageTransition>
  );
}
