"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  MessageSquare,
  FileDown,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  ExternalLink,
  Share2,
  Copy,
  Check,
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

// ---------- 円形プログレス ----------
function CircularScore({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-muted"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          stroke="url(#score-grad)"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-[var(--accent-blue)]">
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground">適合度</span>
      </div>
    </div>
  );
}

// ---------- 年収レンジバー ----------
function SalaryBar({
  min,
  max,
  unit,
}: {
  min: number;
  max: number;
  unit: string;
}) {
  const absMax = 1500;
  const leftPct = (min / absMax) * 100;
  const widthPct = ((max - min) / absMax) * 100;

  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>年収レンジ</span>
        <span className="font-medium text-foreground">
          {min}〜{max}
          {unit}
        </span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden relative">
        <motion.div
          className="absolute h-full rounded-full bg-accent-gradient"
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ left: `${leftPct}%` }}
        />
      </div>
    </div>
  );
}

// ---------- キャリアパスカード ----------
function CareerPathCard({
  path,
  index,
  onShare,
}: {
  path: CareerPath;
  index: number;
  onShare: () => Promise<ShareUrls>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(index === 0);

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
              <CardTitle className="text-xl mb-1 leading-tight">
                {path.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {path.description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* 年収レンジ */}
          <SalaryBar
            min={path.salary_range.min}
            max={path.salary_range.max}
            unit={path.salary_range.unit}
          />

          {/* 推薦理由 */}
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              推薦理由
            </div>
            <p className="text-sm text-muted-foreground">
              {path.why_recommended}
            </p>
          </div>

          {/* 必要スキル */}
          <div>
            <p className="text-sm font-medium mb-2">必要スキル</p>
            <div className="flex flex-wrap gap-1.5">
              {path.required_skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          {/* 展開トグル */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                詳細を閉じる <ChevronUp className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                詳細を見る <ChevronDown className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
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
                        <p className="text-xs font-medium text-primary">
                          {item.period}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* メリット */}
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  <ThumbsUp className="w-4 h-4 text-green-500" />
                  メリット
                </div>
                <ul className="space-y-1">
                  {path.pros.map((pro, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-green-500 mt-1 flex-shrink-0">
                        ●
                      </span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>

              {/* デメリット */}
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  <ThumbsDown className="w-4 h-4 text-orange-500" />
                  デメリット
                </div>
                <ul className="space-y-1">
                  {path.cons.map((con, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-orange-500 mt-1 flex-shrink-0">
                        ●
                      </span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>

              {/* リスク */}
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  考慮すべきリスク
                </div>
                <p className="text-sm text-muted-foreground">{path.risks}</p>
              </div>

              {/* 面接対策ボタン */}
              <div className="pt-2">
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    localStorage.setItem("interviewTarget", path.title);
                    router.push("/interview");
                  }}
                >
                  <GraduationCap className="w-4 h-4" />
                  面接対策をする
                </Button>
              </div>

              {/* LINE相談リンク */}
              <div className="text-center pt-1">
                <LineShareButton
                  context="result"
                  onShare={onShare}
                  compact
                  label="このプランについて相談する"
                />
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
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

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const raw = localStorage.getItem("analysisResult");
    if (!raw) {
      router.replace("/diagnosis");
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      router.replace("/diagnosis");
    }

    try {
      const diagRaw = localStorage.getItem("diagnosisData");
      if (diagRaw) setDiag(JSON.parse(diagRaw));
    } catch {
      // ignore
    }
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
        body: JSON.stringify({
          analysisResult: result,
          diagnosisData: diag ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "共有リンクの作成に失敗しました。");
      }
      const url = `${window.location.origin}/result/share/${data.shareId}`;
      setShareUrl(url);
      setShowShareDialog(true);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "共有リンクの作成に失敗しました。"
      );
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
      // fallback
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
    if (!url) {
      url = localStorage.getItem("career-ai-share-url") ?? null;
    }
    if (!url && result) {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisResult: result,
          diagnosisData: diag ?? undefined,
        }),
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

  // レーダーチャート用データ
  const { allSkillKeys, radarData } = useMemo(() => {
    if (!result) return { allSkillKeys: [] as string[], radarData: [] as { skill: string; 現在: number; 目標: number }[] };
    const keys = Array.from(
      new Set([
        ...Object.keys(result.skill_analysis.current_skills),
        ...Object.keys(result.skill_analysis.target_skills),
      ])
    );
    const data = keys.map((skill) => ({
      skill,
      現在: result.skill_analysis.current_skills[skill] ?? 0,
      目標: result.skill_analysis.target_skills[skill] ?? 0,
    }));
    return { allSkillKeys: keys, radarData: data };
  }, [result]);

  if (!result) {
    return (
      <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-3 animate-pulse">
            <div className="h-9 w-72 bg-muted rounded mx-auto" />
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 w-16 bg-muted rounded-full" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 animate-pulse">
            <div className="h-5 w-5 bg-muted rounded" />
            <div className="h-6 w-48 bg-muted rounded" />
          </div>
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 w-40 bg-muted rounded" />
                    <div className="h-4 w-full bg-muted rounded" />
                    <div className="h-4 w-3/4 bg-muted rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-3 w-full bg-muted rounded-full" />
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-6 w-16 bg-muted rounded-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
          <h1 className="text-3xl font-bold font-heading mb-2 bg-accent-gradient bg-clip-text text-transparent">
            あなたへのキャリアプラン
          </h1>
          {diag && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {diag.ageRange && <Badge variant="outline">{diag.ageRange}</Badge>}
              {diag.jobType && (
                <Badge variant="outline">
                  {diag.jobType === "その他" ? diag.jobTypeOther : diag.jobType}
                </Badge>
              )}
              {diag.industry && (
                <Badge variant="outline">{diag.industry}</Badge>
              )}
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
              <CareerPathCard key={path.title} path={path} index={i} onShare={getOrCreateResultShareUrl} />
            ))}
          </div>
        </section>

        {/* スキルギャップ分析 */}
        {radarData.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>スキルギャップ分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[350px] sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%">
                      <PolarGrid strokeDasharray="3 3" />
                      <PolarAngleAxis
                        dataKey="skill"
                        tick={{ fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 10]}
                        tick={{ fontSize: 10 }}
                      />
                      <Radar
                        name="現在のスキル"
                        dataKey="現在"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name="目標スキル"
                        dataKey="目標"
                        stroke="hsl(12, 76%, 61%)"
                        fill="hsl(12, 76%, 61%)"
                        fillOpacity={0.15}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* 凡例テーブル */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm">
                  {allSkillKeys.map((skill) => {
                    const current =
                      result.skill_analysis.current_skills[skill] ?? 0;
                    const target =
                      result.skill_analysis.target_skills[skill] ?? 0;
                    const gap = target - current;
                    return (
                      <div
                        key={skill}
                        className="flex items-center justify-between py-1 border-b border-border/50"
                      >
                        <span className="text-muted-foreground">{skill}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{current}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{target}</span>
                          {gap > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs text-orange-500 border-orange-500/30"
                            >
                              +{gap}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* 総合アドバイス */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
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

        {/* LINE CTA カード */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.75, type: "spring", stiffness: 300, damping: 24 }}
        >
          <button
            onClick={handleLineCTA}
            className="block w-full rounded-xl px-6 py-5 text-white transition-all hover:brightness-90 hover:-translate-y-0.5 text-left cursor-pointer"
            style={{ backgroundColor: "#06C755" }}
          >
            <div className="flex items-center gap-4">
              <LineIcon className="w-10 h-10 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold leading-snug">
                  無料でエージェントに相談する
                </p>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
                  プロの転職アドバイザーがLINEで無料サポート
                </p>
              </div>
              <ExternalLink className="w-5 h-5 flex-shrink-0 ml-auto opacity-70" />
            </div>
          </button>
        </motion.div>

        {/* アクションボタン */}
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-3 pt-2 pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
        >
          <Link href="/chat">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              <MessageSquare className="w-4 h-4" />
              AIに詳しく相談する
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto gap-2"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {isGeneratingPdf ? "生成中..." : "結果をPDFで保存"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto gap-2"
            onClick={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {isSharing ? "作成中..." : "共有リンクを作成"}
          </Button>
        </motion.div>

        {/* もう一度診断するリンク */}
        <motion.div
          className="text-center pb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <Link
            href="/diagnosis"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            もう一度診断する
          </Link>
        </motion.div>
      </div>

      {/* 共有ダイアログ */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              共有リンク
            </DialogTitle>
            <DialogDescription>
              このリンクを共有すると、誰でもあなたの診断結果を閲覧できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                readOnly
                value={shareUrl ?? ""}
                className="w-full sm:flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm truncate"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto gap-1.5 flex-shrink-0"
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "コピー済み" : "リンクをコピー"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              共有リンクは作成から30日間有効です。取り扱いにご注意ください。
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-lg text-sm max-w-[90vw] text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
    </PageTransition>
  );
}
