"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
  ArrowLeft,
  Loader2,
  Sparkles,
  TrendingUp,
  Target,
  Shield,
  MessageSquare,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3,
  Clock,
  User,
  Briefcase,
  Calendar,
  ClipboardList,
  Compass,
  FileText,
  Heart,
  MapPin,
  Sheet,
  FileDown,
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
import PageTransition from "@/components/PageTransition";
import AIThinking from "@/components/AIThinking";
import type { CareerPath } from "@/lib/types";
import type {
  StoredDiagnosis,
  AgentAnalysisResult,
} from "@/lib/agent-types";
import type { DetailedLifePlan } from "@/lib/self-analysis-types";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { uploadToDriveClient } from "@/lib/client-drive-upload";

// ---------- スコア表示 ----------
function getScoreInfo(score: number) {
  if (score >= 80) return { emoji: "😄", label: "とても合ってる！", color: "#22c55e" };
  if (score >= 60) return { emoji: "😊", label: "合ってる！", color: "#3b82f6" };
  if (score >= 40) return { emoji: "🤔", label: "まあまあ", color: "#f59e0b" };
  return { emoji: "💪", label: "チャレンジ！", color: "#f97316" };
}

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

// ---------- ロードマップ ----------
const STEP_ICONS = ["📚", "🔧", "💼", "🎯", "🚀"];

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

// ---------- 難易度バッジ ----------
function DifficultyBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; className: string }> = {
    easy: { label: "容易", className: "bg-green-100 text-green-700" },
    moderate: { label: "普通", className: "bg-amber-100 text-amber-700" },
    challenging: { label: "難しい", className: "bg-red-100 text-red-700" },
  };
  const info = map[level] ?? map.moderate;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.className}`}>{info.label}</span>;
}

// ---------- 優先度バッジ ----------
function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; className: string }> = {
    high: { label: "高", className: "bg-red-100 text-red-700" },
    medium: { label: "中", className: "bg-amber-100 text-amber-700" },
    low: { label: "低", className: "bg-blue-100 text-blue-700" },
  };
  const info = map[priority] ?? map.medium;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.className}`}>{info.label}</span>;
}

// ---------- セクション ----------
function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; className: string }> = {
    high: { label: "重要", className: "bg-red-100 text-red-700" },
    medium: { label: "注意", className: "bg-amber-100 text-amber-700" },
    low: { label: "参考", className: "bg-blue-100 text-blue-700" },
  };
  const info = map[severity] ?? map.medium;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.className}`}>{info.label}</span>;
}

// ---------- メインページ ----------
export default function AdminResultPage() {
  const router = useRouter();
  const params = useParams();
  const diagnosisId = params.id as string;

  const [stored, setStored] = useState<StoredDiagnosis | null>(null);
  const [agentAnalysis, setAgentAnalysis] = useState<AgentAnalysisResult | null>(null);
  const [detailedPlan, setDetailedPlan] = useState<DetailedLifePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingDetailed, setIsGeneratingDetailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set([0]));
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [isExportingDocs, setIsExportingDocs] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<{ url: string; type: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isCopyingUrl, setIsCopyingUrl] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isExportingResume, setIsExportingResume] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeForm, setResumeForm] = useState({
    name: "",
    date: "",
    workHistory: [{
      companyName: "", periodFrom: "", periodTo: "現在",
      employmentType: "正社員", businessDescription: "",
      capital: "", revenue: "", employees: "", listing: "未上場",
      department: "", deptPeriodFrom: "", deptPeriodTo: "現在",
      duties: "", products: "", clients: "", salesStyle: "",
      achievements: "", projects: "",
    }],
    pcSkills: { word: "", excel: "", powerpoint: "", other: "" },
    qualifications: [{ name: "", date: "" }],
    selfPRMode: "ai" as "ai" | "manual",
    selfPRManual: "",
    summaryMode: "ai" as "ai" | "manual",
    summaryManual: "",
  });
  const { getAccessToken } = useGoogleAuth();
  // モーダル初期化
  useEffect(() => {
    if (showResumeModal && stored) {
      setResumeForm(prev => ({
        ...prev,
        name: stored.diagnosisData.name || "",
        date: new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }),
      }));
    }
  }, [showResumeModal, stored]);

  // データ取得
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/diagnoses?id=${diagnosisId}`);
        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStored(data);
        if (data.agentAnalysis) {
          setAgentAnalysis(data.agentAnalysis);
        }
        if (data.detailedPlan) {
          setDetailedPlan(data.detailedPlan);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [diagnosisId, router]);

  // エージェント分析の生成
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/analyze-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosisId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAgentAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析の生成に失敗しました");
    } finally {
      setIsGenerating(false);
    }
  }, [diagnosisId]);

  // 詳細キャリア・人生プラン生成
  const handleGenerateDetailed = useCallback(async () => {
    setIsGeneratingDetailed(true);
    try {
      const res = await fetch("/api/analyze-detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosisId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetailedPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "詳細プランの生成に失敗しました");
    } finally {
      setIsGeneratingDetailed(false);
    }
  }, [diagnosisId]);

  // 診断結果URLをコピー
  const handleCopyResultUrl = useCallback(async () => {
    if (!stored) return;
    setIsCopyingUrl(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisResult: stored.analysisResult,
          diagnosisData: stored.diagnosisData,
          diagnosisId,
        }),
      });
      if (!res.ok) throw new Error("共有リンクの作成に失敗しました");
      const { shareId } = await res.json();
      const url = `${window.location.origin}/result/share/${shareId}`;
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 3000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "URLのコピーに失敗しました");
    } finally {
      setIsCopyingUrl(false);
    }
  }, [stored]);

  // 職務経歴書エクスポート
  const handleExportResume = useCallback(async () => {
    setIsExportingResume(true);
    setExportedUrl(null);
    setExportError(null);

    try {
      // 1. サーバーでファイル生成
      const res = await fetch("/api/admin/export/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosisId,
          name: resumeForm.name,
          date: resumeForm.date,
          workHistory: resumeForm.workHistory,
          pcSkills: resumeForm.pcSkills,
          qualifications: resumeForm.qualifications.filter(q => q.name),
          selfPR: { mode: resumeForm.selfPRMode, manualContent: resumeForm.selfPRManual },
          summary: { mode: resumeForm.summaryMode, manualContent: resumeForm.summaryManual },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = "職務経歴書の作成に失敗しました";
        try { msg = JSON.parse(text).error || msg; } catch { if (text) msg = text; }
        throw new Error(msg);
      }

      const fileData = await res.json();

      // 2. Google ログイン → ユーザーの Drive にアップロード
      const token = await getAccessToken();
      const url = await uploadToDriveClient(
        token,
        fileData.data,
        fileData.fileName,
        fileData.mimeType,
        fileData.googleMimeType,
      );

      setExportedUrl({ url, type: "Google ドキュメント（職務経歴書）" });
      setShowResumeModal(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "職務経歴書の作成に失敗しました";
      if (msg === "GOOGLE_AUTH_TIMEOUT") {
        setExportError("Google ログインがタイムアウトしました。ポップアップを許可してください。");
      } else {
        setExportError(msg);
      }
    } finally {
      setIsExportingResume(false);
    }
  }, [diagnosisId, resumeForm, getAccessToken]);

  // エクスポート（サーバーでファイル生成 → Google ログイン → Drive にアップロード）
  const handleExport = useCallback(async (type: "sheets" | "docs") => {
    const setLoading = type === "sheets" ? setIsExportingSheets : setIsExportingDocs;
    setLoading(true);
    setExportedUrl(null);
    setExportError(null);

    try {
      // 1. サーバーでファイル生成
      const res = await fetch(`/api/admin/export/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosisId }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "エクスポートに失敗しました";
        try { msg = JSON.parse(text).error || msg; } catch { if (text) msg = text; }
        throw new Error(msg);
      }

      const fileData = await res.json();

      // 2. Google ログイン → ユーザーの Drive にアップロード
      const token = await getAccessToken();
      const url = await uploadToDriveClient(
        token,
        fileData.data,
        fileData.fileName,
        fileData.mimeType,
        fileData.googleMimeType,
      );

      const label = type === "sheets" ? "Google スプレッドシート" : "Google ドキュメント";
      setExportedUrl({ url, type: label });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "エクスポートに失敗しました";
      if (msg === "GOOGLE_AUTH_TIMEOUT") {
        setExportError("Google ログインがタイムアウトしました。ポップアップを許可してください。");
      } else {
        setExportError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [diagnosisId, getAccessToken]);

  const togglePlan = (i: number) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // ローディング
  if (isLoading) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </PageTransition>
    );
  }

  if (error && !stored) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Link href="/admin">
              <Button variant="outline">管理画面に戻る</Button>
            </Link>
          </div>
        </main>
      </PageTransition>
    );
  }

  if (!stored) return null;

  const { diagnosisData: diag, analysisResult: result } = stored;
  const mainPath = result.career_paths[0];

  // スキルチャートデータ
  const barData = (() => {
    const keys = Array.from(new Set([
      ...Object.keys(result.skill_analysis.current_skills),
      ...Object.keys(result.skill_analysis.target_skills),
    ]));
    return keys.map((skill) => ({
      skill,
      いま: result.skill_analysis.current_skills[skill] ?? 0,
      目標: result.skill_analysis.target_skills[skill] ?? 0,
    }));
  })();

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 診断結果URLコピー */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button
              variant={copiedUrl ? "default" : "outline"}
              className={`w-full gap-2 ${copiedUrl ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
              onClick={handleCopyResultUrl}
              disabled={isCopyingUrl}
            >
              {isCopyingUrl ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : copiedUrl ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copiedUrl ? "URLをコピーしました" : "求職者の診断結果URLをコピー"}
            </Button>
          </motion.div>

          {/* ナビ + エクスポート */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              管理画面に戻る
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => handleExport("sheets")}
                disabled={isExportingSheets}
              >
                {isExportingSheets ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sheet className="w-4 h-4" />}
                スプレッドシート
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => handleExport("docs")}
                disabled={isExportingDocs}
              >
                {isExportingDocs ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                ドキュメント
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowResumeModal(true)}
              >
                <ClipboardList className="w-4 h-4" />
                職務経歴書
              </Button>
            </div>
          </motion.div>

          {/* エクスポートエラー */}
          {exportError && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-red-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{exportError}</span>
                </div>
                <button
                  onClick={() => setExportError(null)}
                  className="text-red-600 hover:text-red-800 text-xs"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          )}

          {/* エクスポート成功リンク */}
          {exportedUrl && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{exportedUrl.type}を作成しました</span>
                </div>
                <div className="flex items-center gap-2">
                  {exportedUrl.url && (
                    <button
                      type="button"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = exportedUrl.url;
                        a.target = "_blank";
                        a.rel = "noopener noreferrer";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                    >
                      開く
                      <ArrowLeft className="w-3.5 h-3.5 rotate-[135deg]" />
                    </button>
                  )}
                  <button
                    onClick={() => setExportedUrl(null)}
                    className="text-green-600 hover:text-green-800 text-xs"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 求職者情報 */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  求職者情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {diag.name && (
                  <p className="text-lg font-bold">{diag.name}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Calendar className="w-3 h-3" />{diag.ageRange}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Briefcase className="w-3 h-3" />{diag.jobType}{diag.jobType === "その他" && diag.jobTypeOther ? `（${diag.jobTypeOther}）` : ""}
                  </Badge>
                  <Badge variant="outline">{diag.employmentStatus}</Badge>
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">気になること:</span> {diag.concerns.join("、")}</p>
                  <p><span className="text-muted-foreground">大事にしたいこと:</span> {diag.values.join("、")}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  診断日時: {new Date(stored.createdAt).toLocaleString("ja-JP")}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* ---------- 基本分析結果 ---------- */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="text-lg font-bold font-heading mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              基本分析結果
            </h2>
          </motion.div>

          {/* メインキャリアパス */}
          {mainPath && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col items-center text-center gap-3">
                    <BigScore score={mainPath.match_score} />
                    <div>
                      <Badge className="mb-2">イチオシ</Badge>
                      <h3 className="text-xl font-bold">{mainPath.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{mainPath.description}</p>
                      <p className="text-sm mt-2">
                        年収目安: <span className="font-bold">{mainPath.salary_range.min}〜{mainPath.salary_range.max}{mainPath.salary_range.unit}</span>
                      </p>
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-3">
                    <p className="text-sm font-medium flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-4 h-4 text-primary" />なぜおすすめ？
                    </p>
                    <p className="text-sm text-muted-foreground">{mainPath.why_recommended}</p>
                  </div>
                  {/* ProsCons inline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-green-50 rounded-lg p-3 space-y-1.5">
                      <p className="text-sm font-medium flex items-center gap-1.5 text-green-700">
                        <CheckCircle2 className="w-4 h-4" />いいところ
                      </p>
                      <ul className="space-y-1">
                        {mainPath.pros.map((p, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 space-y-1.5">
                      <p className="text-sm font-medium flex items-center gap-1.5 text-amber-700">
                        <AlertTriangle className="w-4 h-4" />気をつけること
                      </p>
                      <ul className="space-y-1">
                        {[...mainPath.cons, mainPath.risks].filter(Boolean).map((w, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span>{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ロードマップ */}
          {mainPath && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />やることステップ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RoadmapTimeline roadmap={mainPath.roadmap} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* スキルチャート */}
          {barData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">スキルチェック</CardTitle>
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
            </motion.div>
          )}

          {/* その他のキャリアパス */}
          {result.career_paths.slice(1).map((path, i) => (
            <motion.div key={path.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">{path.title}</h3>
                      <p className="text-sm text-muted-foreground">{path.description}</p>
                      <p className="text-xs mt-1">マッチ度: {path.match_score}点 | 年収: {path.salary_range.min}〜{path.salary_range.max}{path.salary_range.unit}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* AIアドバイス */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
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
          </motion.div>

          {/* ============================================================ */}
          {/* エージェント向け分析セクション */}
          {/* ============================================================ */}
          <motion.div
            className="pt-4 border-t-2 border-dashed border-primary/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              エージェント向け詳細分析
            </h2>

            {/* 未生成の場合 */}
            {!agentAnalysis && !isGenerating && (
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    転職エージェント目線の詳細分析はまだ生成されていません。
                  </p>
                  <Button onClick={handleGenerate} className="gap-2">
                    <Zap className="w-4 h-4" />
                    エージェント分析を生成
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 生成中 */}
            {isGenerating && (
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <AIThinking text="" />
                  <p className="text-sm text-muted-foreground">
                    エージェント向け分析を生成しています...（約30秒）
                  </p>
                </CardContent>
              </Card>
            )}

            {/* エラー表示 */}
            {error && agentAnalysis === null && !isGenerating && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
            )}

            {/* 生成済みの場合 */}
            {agentAnalysis && (
              <div className="space-y-5">
                {/* エージェント総括 */}
                <Card className="border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent-gradient flex items-center justify-center flex-shrink-0">
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">エージェント所見</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{agentAnalysis.agent_summary}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 詳細キャリアプラン */}
                <div className="space-y-3">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    詳細キャリアプラン
                  </h3>
                  {agentAnalysis.detailed_career_plans.map((plan, i) => {
                    const isExpanded = expandedPlans.has(i);
                    return (
                      <Card key={plan.title}>
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-bold">{plan.title}</h4>
                                <DifficultyBadge level={plan.transition_difficulty} />
                              </div>
                              <p className="text-sm text-muted-foreground">{plan.detailed_description}</p>
                              <p className="text-sm mt-1">
                                マッチ度: <span className="font-bold">{plan.match_score}点</span>
                                {" | "}年収: {plan.salary_range.min}〜{plan.salary_range.max}{plan.salary_range.unit}
                                {" | "}市場平均: {plan.salary_range.market_average}{plan.salary_range.unit}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="ghost" size="sm" className="w-full"
                            onClick={() => togglePlan(i)}
                          >
                            {isExpanded ? <>閉じる <ChevronUp className="w-4 h-4 ml-1" /></> : <>詳細を見る <ChevronDown className="w-4 h-4 ml-1" /></>}
                          </Button>

                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="space-y-4"
                            >
                              {/* 推薦理由 */}
                              <div className="bg-primary/5 rounded-lg p-3">
                                <p className="text-sm font-medium mb-1">推薦理由</p>
                                <p className="text-sm text-muted-foreground">{plan.why_recommended}</p>
                              </div>

                              {/* ロードマップ */}
                              <div>
                                <p className="text-sm font-medium mb-2">ロードマップ</p>
                                <div className="relative pl-8 space-y-3">
                                  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-[var(--accent-blue)] to-[var(--accent-cyan)]" />
                                  {plan.roadmap.map((step, si) => (
                                    <div key={step.step} className="relative">
                                      <div className="absolute -left-8 top-0 w-8 h-8 rounded-full bg-background border-2 border-[var(--accent-blue)] flex items-center justify-center text-base">
                                        {STEP_ICONS[si] || "📌"}
                                      </div>
                                      <div className="bg-muted/50 rounded-lg p-3 ml-2">
                                        <Badge variant="secondary" className="text-xs mb-1">{step.period}</Badge>
                                        <p className="text-sm font-medium">{step.action}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{step.detail}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* スキル開発 */}
                              <div className="bg-blue-50 rounded-lg p-3">
                                <p className="text-sm font-medium text-blue-700 mb-1">スキル開発プラン</p>
                                <p className="text-sm">{plan.skill_development_plan}</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {plan.required_skills.map((s) => (
                                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                                  ))}
                                </div>
                              </div>

                              {/* メリット・デメリット */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="bg-green-50 rounded-lg p-3 space-y-1.5">
                                  <p className="text-sm font-medium text-green-700 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" />メリット
                                  </p>
                                  <ul className="space-y-1">
                                    {plan.pros.map((p, pi) => (
                                      <li key={pi} className="text-sm flex items-start gap-2">
                                        <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{p}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="bg-amber-50 rounded-lg p-3 space-y-1.5">
                                  <p className="text-sm font-medium text-amber-700 flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4" />デメリット・リスク
                                  </p>
                                  <ul className="space-y-1">
                                    {[...plan.cons, plan.risks].filter(Boolean).map((w, wi) => (
                                      <li key={wi} className="text-sm flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span>{w}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* 具体的推奨 */}
                              <div className="bg-purple-50 rounded-lg p-3">
                                <p className="text-sm font-medium text-purple-700 mb-2">求職者へのアドバイスポイント</p>
                                <ul className="space-y-1.5">
                                  {plan.specific_recommendations.map((r, ri) => (
                                    <li key={ri} className="text-sm flex items-start gap-2">
                                      <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />{r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </motion.div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* スキルギャップ分析 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      スキルギャップ分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {agentAnalysis.skill_gap_analysis.map((sg) => (
                        <div key={sg.skill_name} className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{sg.skill_name}</span>
                            <div className="flex items-center gap-2">
                              <PriorityBadge priority={sg.priority} />
                              <span className="text-xs text-muted-foreground">
                                {sg.current_level} → {sg.target_level} (ギャップ: {sg.gap})
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                            <div
                              className="h-full bg-accent-gradient rounded-full"
                              style={{ width: `${(sg.current_level / sg.target_level) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">{sg.improvement_method}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{sg.estimated_time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 市場動向 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      市場動向
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">業界トレンド</p>
                        <p className="text-sm">{agentAnalysis.market_insights.industry_trend}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">需要レベル</p>
                        <p className="text-sm">{agentAnalysis.market_insights.demand_level}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">競争環境</p>
                        <p className="text-sm">{agentAnalysis.market_insights.competition_level}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">将来の見通し</p>
                        <p className="text-sm">{agentAnalysis.market_insights.future_outlook}</p>
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">推奨タイミング</p>
                      <p className="text-sm">{agentAnalysis.market_insights.recommended_timing}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 年収交渉 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary" />
                      年収交渉アドバイス
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">市場年収レンジ</p>
                      <p className="text-lg font-bold text-green-700">
                        {agentAnalysis.salary_negotiation.current_market_range.min}〜{agentAnalysis.salary_negotiation.current_market_range.max}万円
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">交渉ポイント</p>
                      <ul className="space-y-1.5">
                        {agentAnalysis.salary_negotiation.negotiation_points.map((p, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">強みとなる要素</p>
                      <ul className="space-y-1.5">
                        {agentAnalysis.salary_negotiation.leverage_factors.map((f, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">タイミング</p>
                      <p className="text-sm">{agentAnalysis.salary_negotiation.timing_advice}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* 面接対策 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      面接対策
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">想定質問</p>
                      <ul className="space-y-2">
                        {agentAnalysis.interview_preparation.key_questions.map((q, i) => (
                          <li key={i} className="text-sm bg-muted/50 rounded-lg p-3">
                            Q. {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">アピールポイント</p>
                      <ul className="space-y-1.5">
                        {agentAnalysis.interview_preparation.talking_points.map((t, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />{t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">面接官が懸念しそうな点</p>
                      <ul className="space-y-1.5">
                        {agentAnalysis.interview_preparation.potential_concerns.map((c, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">見せ方のコツ</p>
                      <ul className="space-y-1.5">
                        {agentAnalysis.interview_preparation.presentation_tips.map((t, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />{t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* レッドフラグ */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      注意すべきポイント
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {agentAnalysis.red_flags.map((rf, i) => (
                        <div key={i} className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium">{rf.flag}</p>
                            <SeverityBadge severity={rf.severity} />
                          </div>
                          <p className="text-xs text-muted-foreground">対策: {rf.mitigation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>

          {/* ============================================================ */}
          {/* 自己分析回答セクション */}
          {/* ============================================================ */}
          <motion.div
            className="pt-4 border-t-2 border-dashed border-primary/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              自己分析アンケート
            </h2>

            {!stored.selfAnalysis && (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    求職者はまだ自己分析アンケートに回答していません。
                  </p>
                </CardContent>
              </Card>
            )}

            {stored.selfAnalysis && (() => {
              const sa = stored.selfAnalysis;
              return (
                <div className="space-y-4">
                  {/* 氏名 */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">氏名</span>
                      </div>
                      <p className="text-lg font-bold">{sa.name}</p>
                      {stored.selfAnalysisAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          回答日時: {new Date(stored.selfAnalysisAt).toLocaleString("ja-JP")}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 強みと適性 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        強みと適性
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">自然に得意:</span>{" "}
                        {sa.naturalStrengths.join("、")}
                        {sa.naturalStrengthsOther && `、${sa.naturalStrengthsOther}`}
                      </div>
                      <div>
                        <span className="text-muted-foreground">褒められた経験:</span>{" "}
                        {sa.praisedExperiences.join("、")}
                        {sa.praisedExperiencesOther && `、${sa.praisedExperiencesOther}`}
                      </div>
                      {sa.strengths && sa.strengths.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">強み:</span>{" "}
                          {sa.strengths.join("、")}
                          {sa.strengthsOther && `、${sa.strengthsOther}`}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* 趣味・適性 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Heart className="w-4 h-4 text-primary" />
                        趣味・適性
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">集中できる趣味:</span>{" "}
                        {sa.focusedHobbies.join("、")}
                        {sa.focusedHobbiesOther && `、${sa.focusedHobbiesOther}`}
                      </div>
                      <div>
                        <span className="text-muted-foreground">3年以上の趣味:</span>{" "}
                        {sa.longTermHobbies.join("、")}
                        {sa.longTermHobbiesOther && `、${sa.longTermHobbiesOther}`}
                      </div>
                      <div>
                        <span className="text-muted-foreground">教えられるスキル:</span>{" "}
                        {sa.teachableSkills.join("、")}
                        {sa.teachableSkillsOther && `、${sa.teachableSkillsOther}`}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 経験・価値観 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Compass className="w-4 h-4 text-primary" />
                        経験・価値観
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">感謝された経験:</span>{" "}
                        {sa.appreciatedExperiences.join("、")}
                        {sa.appreciatedExperiencesOther && `、${sa.appreciatedExperiencesOther}`}
                      </div>
                      <div>
                        <span className="text-muted-foreground">遭難シナリオ:</span>{" "}
                        {sa.survivalScenario}
                        {sa.survivalScenarioOther && `（${sa.survivalScenarioOther}）`}
                      </div>
                      <div>
                        <span className="text-muted-foreground">理由:</span>{" "}
                        {sa.survivalScenarioReason}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 仕事の価値観 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-primary" />
                        仕事の価値観
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">大切にしたいこと:</span>{" "}
                        1位={sa.workValue1}, 2位={sa.workValue2}, 3位={sa.workValue3}
                      </div>
                      <div>
                        <span className="text-muted-foreground">働くとは:</span>{" "}
                        1位={sa.workMeaning1}, 2位={sa.workMeaning2}, 3位={sa.workMeaning3}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 人生設計 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        人生設計
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><span className="text-muted-foreground">結婚:</span> {sa.marriage}</div>
                      <div><span className="text-muted-foreground">子ども:</span> {sa.children}{sa.childrenOther && `（${sa.childrenOther}）`}</div>
                      <div><span className="text-muted-foreground">家賃:</span> {sa.rent}{sa.rentOther && `（${sa.rentOther}）`}</div>
                      <div><span className="text-muted-foreground">一番大事:</span> {sa.priority}{sa.priorityOther && `（${sa.priorityOther}）`}</div>
                      <div><span className="text-muted-foreground">仕事一筋度:</span> {sa.workDedication}/5</div>
                      <div><span className="text-muted-foreground">希望年収:</span> {sa.desiredIncome}{sa.desiredIncomeOther && `（${sa.desiredIncomeOther}）`}</div>
                    </CardContent>
                  </Card>

                  {/* 希望条件・現在の状況 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        希望条件 / 現在の状況
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1.5">
                          <p className="font-medium text-xs text-muted-foreground border-b pb-1">希望条件</p>
                          <div>企業知名度: {sa.desiredCompanyFame}/5</div>
                          <div>勤務時間: {sa.desiredWorkHours}</div>
                          <div>勤務地: {sa.desiredLocation}</div>
                          <div>残業: {sa.desiredOvertime}</div>
                          <div>職種: {sa.desiredJobTypes.join("、")}</div>
                          <div>業種: {sa.desiredIndustries.join("、")}</div>
                          <div>雰囲気: {sa.desiredAtmosphere}</div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-medium text-xs text-muted-foreground border-b pb-1">現在の状況</p>
                          <div>年収: {sa.currentIncome}</div>
                          <div>企業知名度: {sa.currentCompanyFame}/5</div>
                          <div>勤務地: {sa.currentLocation}</div>
                          <div>残業: {sa.currentOvertime}</div>
                          <div>職種: {sa.currentJobType}</div>
                          <div>業種: {sa.currentIndustry}</div>
                          <div>雰囲気: {sa.currentAtmosphere}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 転職改善ポイント */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        転職改善ポイントTOP5
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-1 text-sm list-decimal list-inside">
                        <li>{sa.improvement1}{sa.improvement1Other && `（${sa.improvement1Other}）`}</li>
                        <li>{sa.improvement2}{sa.improvement2Other && `（${sa.improvement2Other}）`}</li>
                        <li>{sa.improvement3}{sa.improvement3Other && `（${sa.improvement3Other}）`}</li>
                        <li>{sa.improvement4}{sa.improvement4Other && `（${sa.improvement4Other}）`}</li>
                        <li>{sa.improvement5}{sa.improvement5Other && `（${sa.improvement5Other}）`}</li>
                      </ol>
                    </CardContent>
                  </Card>

                  {/* ============================================================ */}
                  {/* 詳細キャリア・人生プラン */}
                  {/* ============================================================ */}
                  <div className="pt-4 border-t border-dashed border-primary/20">
                    <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      詳細キャリア・人生プラン
                    </h3>

                    {!detailedPlan && !isGeneratingDetailed && (
                      <Card>
                        <CardContent className="pt-6 text-center space-y-4">
                          <p className="text-sm text-muted-foreground">
                            自己分析データを含めた詳細なキャリア・人生プランを生成できます。
                          </p>
                          <Button onClick={handleGenerateDetailed} className="gap-2">
                            <Zap className="w-4 h-4" />
                            詳細プランを生成
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {isGeneratingDetailed && (
                      <Card>
                        <CardContent className="pt-6 text-center space-y-4">
                          <AIThinking text="" />
                          <p className="text-sm text-muted-foreground">
                            詳細キャリア・人生プランを生成しています...（約40秒）
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {detailedPlan && (
                      <div className="space-y-4">
                        {/* パーソナルプロフィール */}
                        <Card className="border-primary/20">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">パーソナルプロフィール</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-sm leading-relaxed">{detailedPlan.personalProfile.summary}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {detailedPlan.personalProfile.coreStrengths.map((s) => (
                                <Badge key={s} variant="secondary">{s}</Badge>
                              ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              <div className="bg-muted/50 rounded-lg p-2">
                                <span className="text-xs text-muted-foreground">パーソナリティ</span>
                                <p>{detailedPlan.personalProfile.personalityType}</p>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-2">
                                <span className="text-xs text-muted-foreground">適した働き方</span>
                                <p>{detailedPlan.personalProfile.workStyle}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* キャリア戦略 */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Target className="w-4 h-4 text-primary" />
                              キャリア戦略
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {(["shortTerm", "midTerm", "longTerm"] as const).map((key) => {
                              const strategy = detailedPlan.careerStrategy[key];
                              const labels = { shortTerm: "短期", midTerm: "中期", longTerm: "長期" };
                              return (
                                <div key={key} className="bg-muted/50 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="text-xs">{labels[key]}</Badge>
                                    <span className="text-xs text-muted-foreground">{strategy.period}</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-muted-foreground">目標:</p>
                                    <ul className="space-y-1">
                                      {strategy.goals.map((g, gi) => (
                                        <li key={gi} className="text-sm flex items-start gap-2">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />{g}
                                        </li>
                                      ))}
                                    </ul>
                                    <p className="text-xs font-medium text-muted-foreground mt-2">アクション:</p>
                                    <ul className="space-y-1">
                                      {strategy.actions.map((a, ai) => (
                                        <li key={ai} className="text-sm flex items-start gap-2">
                                          <span className="text-primary mt-0.5 flex-shrink-0">-</span>{a}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>

                        {/* ライフプラン */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Heart className="w-4 h-4 text-primary" />
                              ライフプラン
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {([
                              { key: "financialPlan", label: "経済面" },
                              { key: "familyPlan", label: "家庭" },
                              { key: "lifestyleAdvice", label: "ライフスタイル" },
                              { key: "balanceStrategy", label: "バランス戦略" },
                            ] as const).map(({ key, label }) => (
                              <div key={key} className="bg-muted/50 rounded-lg p-3">
                                <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                                <p className="text-sm">{detailedPlan.lifePlan[key]}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        {/* ギャップ分析 */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-primary" />
                              ギャップ分析
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {detailedPlan.gapAnalysis.currentVsDesired.map((gap, gi) => (
                                <div key={gi} className="bg-muted/50 rounded-lg p-3">
                                  <p className="text-sm font-medium mb-1">{gap.area}</p>
                                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                    <div className="bg-background rounded p-1.5">
                                      <span className="text-muted-foreground">現在:</span> {gap.current}
                                    </div>
                                    <div className="bg-background rounded p-1.5">
                                      <span className="text-muted-foreground">希望:</span> {gap.desired}
                                    </div>
                                  </div>
                                  <p className="text-xs text-primary">{gap.action}</p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* 推奨 */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              推奨事項
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <p className="text-sm font-medium mb-2">推奨職種</p>
                              <div className="space-y-2">
                                {detailedPlan.detailedRecommendations.jobRecommendations.map((job, ji) => (
                                  <div key={ji} className="bg-muted/50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium">{job.title}</span>
                                      <Badge variant="secondary" className="text-xs">適合度: {job.fit}%</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{job.reason}</p>
                                    <p className="text-xs mt-1">想定年収: {job.salary}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium mb-2">スキル開発</p>
                              <div className="space-y-2">
                                {detailedPlan.detailedRecommendations.skillDevelopment.map((sd, si) => (
                                  <div key={si} className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-sm font-medium">{sd.skill}</p>
                                    <p className="text-xs text-muted-foreground">{sd.method}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                      <Clock className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">{sd.timeline}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-blue-700 mb-1">人脈構築</p>
                              <p className="text-sm">{detailedPlan.detailedRecommendations.networkingAdvice}</p>
                            </div>
                          </CardContent>
                        </Card>

                        {/* エージェント面談ポイント */}
                        <Card className="border-primary/20">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-primary" />
                              面談で伝えるべきポイント
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {detailedPlan.agentTalkingPoints.map((point, pi) => (
                                <li key={pi} className="text-sm flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>

                        {/* 総合所見 */}
                        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                          <CardContent className="pt-6">
                            <div className="flex gap-3">
                              <div className="w-10 h-10 rounded-full bg-accent-gradient flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-medium mb-1">総合所見</p>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {detailedPlan.overallSummary}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </motion.div>

          {/* 戻るリンク */}
          <div className="text-center pb-8">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              管理画面に戻る
            </Link>
          </div>
        </div>
      </main>

      {/* 職務経歴書モーダル */}
      {showResumeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                職務経歴書の作成
              </h2>
              <button onClick={() => setShowResumeModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* 基本情報 */}
              <div>
                <h3 className="font-bold text-sm text-gray-500 mb-3">基本情報</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">氏名</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" value={resumeForm.name}
                      onChange={e => setResumeForm(prev => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">日付</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" value={resumeForm.date}
                      onChange={e => setResumeForm(prev => ({ ...prev, date: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* 職務経歴 */}
              {resumeForm.workHistory.map((work, wi) => (
                <div key={wi} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-500">職務経歴（{wi + 1}社目）</h3>
                    {resumeForm.workHistory.length > 1 && (
                      <button className="text-xs text-red-500" onClick={() => setResumeForm(prev => ({ ...prev, workHistory: prev.workHistory.filter((_, i) => i !== wi) }))}>削除</button>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">会社名</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="株式会社○○○" value={work.companyName}
                      onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], companyName: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">入社年月</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="20xx年xx月" value={work.periodFrom}
                        onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], periodFrom: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">退社年月</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="現在" value={work.periodTo}
                        onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], periodTo: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">雇用形態</label>
                      <select className="w-full border rounded-lg px-3 py-2 text-sm" value={work.employmentType}
                        onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], employmentType: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }}>
                        <option>正社員</option><option>契約社員</option><option>派遣社員</option><option>アルバイト</option><option>業務委託</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">上場区分</label>
                      <select className="w-full border rounded-lg px-3 py-2 text-sm" value={work.listing}
                        onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], listing: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }}>
                        <option>未上場</option><option>東証プライム</option><option>東証スタンダード</option><option>東証グロース</option><option>その他</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">事業内容</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ハードウェア開発、アプリ開発..." value={work.businessDescription}
                      onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], businessDescription: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">資本金</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1億5千万円" value={work.capital}
                        onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], capital: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">売上高</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="3億2千万円" value={work.revenue}
                        onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], revenue: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">従業員数</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="150人" value={work.employees}
                        onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], employees: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">配属部署</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="本社 / 営業部" value={work.department}
                      onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], department: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                  </div>

                  {([
                    ["duties", "業務内容", "中小企業に対するハードウェア販売や..."],
                    ["products", "取扱商品", "OA機器、ログ管理ソフト..."],
                    ["clients", "取引顧客", "従業員数xx人～xxx人以下の中小企業..."],
                    ["salesStyle", "営業スタイル", "新規（xx％）：電話、訪問営業..."],
                    ["achievements", "主な実績", "20xx年度 予算達成率xxx％..."],
                    ["projects", "主なプロジェクト", "1. ネットワーク環境の見直し..."],
                  ] as [string, string, string][]).map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label className="text-xs text-gray-500">{label}</label>
                      <textarea className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px] resize-y" placeholder={placeholder}
                        value={(work as Record<string, string>)[field] || ""}
                        onChange={e => { const h = [...resumeForm.workHistory]; h[wi] = { ...h[wi], [field]: e.target.value }; setResumeForm(prev => ({ ...prev, workHistory: h })); }} />
                    </div>
                  ))}
                </div>
              ))}

              <button className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400"
                onClick={() => setResumeForm(prev => ({
                  ...prev,
                  workHistory: [...prev.workHistory, {
                    companyName: "", periodFrom: "", periodTo: "", employmentType: "正社員", businessDescription: "",
                    capital: "", revenue: "", employees: "", listing: "未上場",
                    department: "", deptPeriodFrom: "", deptPeriodTo: "",
                    duties: "", products: "", clients: "", salesStyle: "", achievements: "", projects: "",
                  }],
                }))}>
                ＋ 職歴を追加する
              </button>

              {/* PCスキル */}
              <div>
                <h3 className="font-bold text-sm text-gray-500 mb-3">PCスキル</h3>
                {(["word", "excel", "powerpoint"] as const).map(key => (
                  <div key={key} className="mb-2">
                    <label className="text-xs text-gray-500">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder={key === "word" ? "報告書等の社内外文書が作成できるレベル" : ""}
                      value={resumeForm.pcSkills[key]}
                      onChange={e => setResumeForm(prev => ({ ...prev, pcSkills: { ...prev.pcSkills, [key]: e.target.value } }))} />
                  </div>
                ))}
              </div>

              {/* 資格 */}
              <div>
                <h3 className="font-bold text-sm text-gray-500 mb-3">資格</h3>
                {resumeForm.qualifications.map((q, qi) => (
                  <div key={qi} className="grid grid-cols-[1fr_auto_auto] gap-2 mb-2">
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder="普通自動車免許" value={q.name}
                      onChange={e => { const qs = [...resumeForm.qualifications]; qs[qi] = { ...qs[qi], name: e.target.value }; setResumeForm(prev => ({ ...prev, qualifications: qs })); }} />
                    <input className="border rounded-lg px-3 py-2 text-sm w-[140px]" placeholder="20xx年xx月取得" value={q.date}
                      onChange={e => { const qs = [...resumeForm.qualifications]; qs[qi] = { ...qs[qi], date: e.target.value }; setResumeForm(prev => ({ ...prev, qualifications: qs })); }} />
                    {resumeForm.qualifications.length > 1 && (
                      <button className="text-red-400 text-xs px-2" onClick={() => setResumeForm(prev => ({ ...prev, qualifications: prev.qualifications.filter((_, i) => i !== qi) }))}>✕</button>
                    )}
                  </div>
                ))}
                <button className="text-sm text-blue-500" onClick={() => setResumeForm(prev => ({ ...prev, qualifications: [...prev.qualifications, { name: "", date: "" }] }))}>
                  ＋ 資格を追加
                </button>
              </div>

              {/* 職務要約 */}
              <div>
                <h3 className="font-bold text-sm text-gray-500 mb-3">職務要約</h3>
                <div className="flex gap-3 mb-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="radio" checked={resumeForm.summaryMode === "ai"} onChange={() => setResumeForm(prev => ({ ...prev, summaryMode: "ai" }))} />
                    自動生成（おすすめ）
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="radio" checked={resumeForm.summaryMode === "manual"} onChange={() => setResumeForm(prev => ({ ...prev, summaryMode: "manual" }))} />
                    自分で入力
                  </label>
                </div>
                {resumeForm.summaryMode === "manual" && (
                  <textarea className="w-full border rounded-lg px-3 py-2 text-sm min-h-[100px]" placeholder="職務要約を入力..."
                    value={resumeForm.summaryManual} onChange={e => setResumeForm(prev => ({ ...prev, summaryManual: e.target.value }))} />
                )}
                {resumeForm.summaryMode === "ai" && <p className="text-xs text-gray-400">職歴情報を元に自動生成します</p>}
              </div>

              {/* 自己PR */}
              <div>
                <h3 className="font-bold text-sm text-gray-500 mb-3">自己PR</h3>
                <div className="flex gap-3 mb-2">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="radio" checked={resumeForm.selfPRMode === "ai"} onChange={() => setResumeForm(prev => ({ ...prev, selfPRMode: "ai" }))} />
                    診断結果から自動生成（おすすめ）
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="radio" checked={resumeForm.selfPRMode === "manual"} onChange={() => setResumeForm(prev => ({ ...prev, selfPRMode: "manual" }))} />
                    自分で入力
                  </label>
                </div>
                {resumeForm.selfPRMode === "manual" && (
                  <textarea className="w-full border rounded-lg px-3 py-2 text-sm min-h-[150px]" placeholder="自己PRを入力..."
                    value={resumeForm.selfPRManual} onChange={e => setResumeForm(prev => ({ ...prev, selfPRManual: e.target.value }))} />
                )}
                {resumeForm.selfPRMode === "ai" && <p className="text-xs text-gray-400">診断結果の強み・スキル・パーソナリティから自動生成します</p>}
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowResumeModal(false)}>キャンセル</Button>
              <Button className="gap-1.5" onClick={handleExportResume} disabled={isExportingResume}>
                {isExportingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                {isExportingResume ? "生成中..." : "職務経歴書を生成する"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
