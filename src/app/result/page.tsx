"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
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
  MessageSquare,
  FileDown,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  ExternalLink,
  Share2,
  FileText,
  Copy,
  Check,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AnalysisResult, CareerPath } from "@/lib/types";
import { generatePdf } from "@/lib/generate-pdf";
import PageTransition from "@/components/PageTransition";
import LineShareButton, { LineIcon } from "@/components/LineShareButton";
import { openLineShare, type ShareUrls } from "@/lib/lineShare";

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
        <motion.div
          key={item.step}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="relative"
        >
          <div className="absolute -left-8 top-0 w-8 h-8 rounded-full bg-background border-2 border-[var(--accent-blue)] flex items-center justify-center text-base">
            {STEP_ICONS[i] || "📌"}
          </div>
          <div className="bg-muted/50 rounded-lg p-3 ml-2">
            <Badge variant="secondary" className="text-xs mb-1">{item.period}</Badge>
            <p className="text-sm">{item.action}</p>
          </div>
        </motion.div>
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
export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const isGeneratingPdfRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [diag, setDiag] = useState<Record<string, any> | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const isSharingRef = useRef(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const shareUrlCacheRef = useRef<string | null>(null);
  const [expandedOthers, setExpandedOthers] = useState<Set<number>>(new Set());

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

  const handleDownloadPdf = useCallback(async () => {
    if (!result || isGeneratingPdfRef.current) return;
    isGeneratingPdfRef.current = true;
    setIsGeneratingPdf(true);
    try {
      await generatePdf(result, diag ?? undefined);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDFの生成に失敗しました。もう一度お試しください。");
    } finally {
      isGeneratingPdfRef.current = false;
      setIsGeneratingPdf(false);
    }
  }, [result, diag]);

  const handleShare = useCallback(async () => {
    if (!result || isSharingRef.current) return;
    isSharingRef.current = true;
    setIsSharing(true);
    setCopied(false);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisResult: result, diagnosisData: diag ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "共有リンクの作成に失敗しました。");
      const url = `${window.location.origin}/result/share/${data.shareId}`;
      setShareUrl(url);
      setShowShareDialog(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "共有リンクの作成に失敗しました。");
    } finally {
      isSharingRef.current = false;
      setIsSharing(false);
    }
  }, [result, diag]);

  const handleCopyUrl = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const getOrCreateResultShareUrl = useCallback(async (): Promise<ShareUrls> => {
    let url = shareUrlCacheRef.current || shareUrl;
    if (!url) url = localStorage.getItem("career-ai-share-url") ?? null;
    if (!url && result) {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisResult: result, diagnosisData: diag ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "共有リンクの作成に失敗しました。");
      url = `${window.location.origin}/result/share/${data.shareId}`;
      localStorage.setItem("career-ai-share-url", url);
      setShareUrl(url);
    }
    if (url) shareUrlCacheRef.current = url;
    return { resultShareUrl: url ?? undefined };
  }, [result, diag, shareUrl]);

  const handleLineCTA = useCallback(async () => {
    try {
      const urls = await getOrCreateResultShareUrl();
      const toast = await openLineShare("result", urls);
      setToastMessage(toast);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "共有に失敗しました");
    }
  }, [getOrCreateResultShareUrl]);

  // スキルチャート用データ
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

  // ローディング
  if (!result) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen py-10 px-4">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center animate-pulse space-y-4">
              <div className="w-36 h-36 rounded-full bg-muted mx-auto" />
              <div className="h-8 w-48 bg-muted rounded mx-auto" />
              <div className="h-4 w-64 bg-muted rounded mx-auto" />
            </div>
          </div>
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

          {/* ① ヘッダー */}
          <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold font-heading mb-1 bg-accent-gradient bg-clip-text text-transparent">
              あなたにぴったりのキャリア
            </h1>
            <p className="text-sm text-muted-foreground">AIがあなたの情報をもとに分析しました</p>
          </motion.div>

          {/* ② メインのキャリアカード */}
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

                  {/* なぜおすすめ？ */}
                  <div className="bg-primary/5 rounded-lg p-3">
                    <p className="text-sm font-medium flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                      なぜおすすめ？
                    </p>
                    <p className="text-sm text-muted-foreground">{mainPath.why_recommended}</p>
                  </div>

                  {/* いいところ・気をつけること */}
                  <ProsCons pros={mainPath.pros} cons={mainPath.cons} risks={mainPath.risks} />

                  {/* 面接対策ボタン */}
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      localStorage.setItem("interviewTarget", mainPath.title);
                      router.push("/interview");
                    }}
                  >
                    <GraduationCap className="w-4 h-4" />
                    面接の練習をする
                  </Button>

                  <div className="text-center">
                    <LineShareButton context="result" onShare={getOrCreateResultShareUrl} compact label="このプランについて相談する" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ③ ロードマップ */}
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

          {/* ④ スキルチャート */}
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

          {/* ⑤ ほかのおすすめ */}
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
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
                            <div className="bg-primary/5 rounded-lg p-3">
                              <p className="text-sm font-medium flex items-center gap-1.5 mb-1">
                                <Sparkles className="w-4 h-4 text-primary" />
                                なぜおすすめ？
                              </p>
                              <p className="text-sm text-muted-foreground">{path.why_recommended}</p>
                            </div>
                            <RoadmapTimeline roadmap={path.roadmap} />
                            <ProsCons pros={path.pros} cons={path.cons} risks={path.risks} />
                            <Button
                              className="w-full gap-2"
                              onClick={() => {
                                localStorage.setItem("interviewTarget", path.title);
                                router.push("/interview");
                              }}
                            >
                              <GraduationCap className="w-4 h-4" />
                              面接の練習をする
                            </Button>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ⑥ AIからのアドバイス */}
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

          {/* ⑦ LINE CTA */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
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

          {/* ⑧ アクションボタン */}
          <motion.div className="flex flex-col sm:flex-row justify-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}>
            <Link href="/chat">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                <MessageSquare className="w-4 h-4" />
                AIにもっと聞く
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {isGeneratingPdf ? "作成中..." : "PDFで保存"}
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2" onClick={handleShare} disabled={isSharing}>
              {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              {isSharing ? "作成中..." : "共有する"}
            </Button>
          </motion.div>

          {/* 履歴書・もう一度 */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            <Link href="/resume">
              <Button variant="outline" className="w-full gap-2">
                <FileText className="w-4 h-4" />
                履歴書をつくる
              </Button>
            </Link>
          </motion.div>
          <motion.div className="text-center pb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
            <Link href="/diagnosis" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
              もう一度やってみる
            </Link>
          </motion.div>
        </div>

        {/* 共有ダイアログ */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Share2 className="w-5 h-5" />共有リンク</DialogTitle>
              <DialogDescription>このリンクで誰でも結果を見られます。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input readOnly value={shareUrl ?? ""} className="w-full sm:flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm truncate" />
                <Button size="sm" variant="outline" className="w-full sm:w-auto gap-1.5 flex-shrink-0" onClick={handleCopyUrl}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? "コピー済み" : "コピー"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">リンクは30日間有効です。</p>
            </div>
          </DialogContent>
        </Dialog>

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
