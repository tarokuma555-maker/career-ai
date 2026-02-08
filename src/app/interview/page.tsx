"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brain,
  Loader2,
  ArrowLeft,
  Send,
  CheckCircle2,
  ExternalLink,
  Star,
  Clock,
  Users,
  MessageCircle,
  Share2,
  Copy,
  Check,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import InterviewReviewCard from "@/components/InterviewReviewResult";
import type {
  InterviewQuestion,
  RichInterviewResult,
  CareerPath,
} from "@/lib/types";
import {
  canUseInterviewReview,
  getInterviewRemaining,
  incrementInterviewReview,
} from "@/lib/chatLimit";

const LINE_URL_FREE =
  "https://lin.ee/JlpMkfy?utm_source=career-ai&utm_medium=interview";

function LineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386a.63.63 0 0 1-.627-.629V8.108a.63.63 0 0 1 .627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016a.63.63 0 0 1-.629.631.626.626 0 0 1-.51-.262l-2.455-3.338v2.969a.63.63 0 0 1-.63.631.627.627 0 0 1-.629-.631V8.108a.627.627 0 0 1 .629-.63c.2 0 .381.095.51.262l2.455 3.333V8.108a.63.63 0 0 1 .63-.63.63.63 0 0 1 .629.63v4.771zm-5.741 0a.63.63 0 0 1-1.26 0V8.108a.631.631 0 0 1 1.26 0v4.771zm-2.451.631H4.932a.63.63 0 0 1-.627-.631V8.108a.63.63 0 0 1 1.26 0v4.141h1.754c.349 0 .63.285.63.63 0 .344-.281.631-.63.631M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

type Phase =
  | "selecting"
  | "loading"
  | "questions"
  | "answering"
  | "reviewing"
  | "result";

export default function InterviewPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("selecting");
  const [careerTitle, setCareerTitle] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<RichInterviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 共有関連
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const isSharingRef = useRef(false);
  const [copied, setCopied] = useState(false);

  // 利用制限
  const [canReview, setCanReview] = useState(true);
  const [reviewRemaining, setReviewRemaining] = useState(1);

  // localStorage読み取り
  useEffect(() => {
    const target = localStorage.getItem("interviewTarget");
    if (!target) {
      router.replace("/result");
      return;
    }
    setCareerTitle(target);
    setCanReview(canUseInterviewReview());
    setReviewRemaining(getInterviewRemaining());
  }, [router]);

  // 質問生成（phase が loading になったら実行）
  useEffect(() => {
    if (phase !== "loading" || !careerTitle) return;

    // キャリアパスの詳細を取得
    let careerDetail = "";
    const analysisRaw = localStorage.getItem("analysisResult");
    if (analysisRaw) {
      try {
        const analysis = JSON.parse(analysisRaw);
        const matched = analysis.career_paths?.find(
          (p: CareerPath) => p.title === careerTitle
        );
        if (matched) {
          careerDetail = [
            `説明: ${matched.description}`,
            `推薦理由: ${matched.why_recommended}`,
            `必要スキル: ${matched.required_skills?.join("、")}`,
          ].join("\n");
        }
      } catch {
        // ignore
      }
    }

    // ユーザープロフィール
    let userProfile = "";
    const diagRaw = localStorage.getItem("diagnosisData");
    if (diagRaw) {
      try {
        const diag = JSON.parse(diagRaw);
        userProfile = [
          diag.ageRange && `年齢層: ${diag.ageRange}`,
          diag.jobType && `職種: ${diag.jobType}`,
          diag.industry && `業界: ${diag.industry}`,
          diag.experienceYears && `経験年数: ${diag.experienceYears}`,
          diag.skills?.length && `スキル: ${diag.skills.join("、")}`,
        ]
          .filter(Boolean)
          .join("\n");
      } catch {
        // ignore
      }
    }

    async function generateQuestions() {
      try {
        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            careerPath: careerTitle,
            careerDetail,
            userProfile,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "質問の生成に失敗しました。");
        }

        const data = await res.json();
        setQuestions(data.questions);
        setPhase("questions");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "質問の生成に失敗しました。"
        );
      }
    }

    generateQuestions();
  }, [phase, careerTitle]);

  // 共有リンク作成
  const handleShareQuestions = useCallback(async () => {
    if (isSharingRef.current || shareUrl) return;
    isSharingRef.current = true;
    setIsSharing(true);

    try {
      const res = await fetch("/api/share-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ careerTitle, questions }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "共有リンクの作成に失敗しました。");
      }

      const data = await res.json();
      const url = `${window.location.origin}/interview/share/${data.shareId}`;
      setShareUrl(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "共有リンクの作成に失敗しました。"
      );
    } finally {
      isSharingRef.current = false;
      setIsSharing(false);
    }
  }, [careerTitle, questions, shareUrl]);

  // URLコピー
  const handleCopyUrl = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [shareUrl]);

  // LINEで質問を送る
  const handleLineShare = useCallback(async () => {
    // まず共有リンクがなければ作成
    let url = shareUrl;
    if (!url) {
      try {
        const res = await fetch("/api/share-interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ careerTitle, questions }),
        });
        if (res.ok) {
          const data = await res.json();
          url = `${window.location.origin}/interview/share/${data.shareId}`;
          setShareUrl(url);
        }
      } catch {
        // 共有リンクなしで続行
      }
    }

    const message = [
      `【面接対策 - ${careerTitle}】`,
      "AIが生成した想定質問です。",
      "",
      ...(url ? [url, ""] : []),
      "面接対策のアドバイスをお願いします。",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // fallback
    }

    window.open(LINE_URL_FREE, "_blank", "noopener,noreferrer");
  }, [shareUrl, careerTitle, questions]);

  // 回答添削
  const handleSubmitReview = useCallback(async () => {
    // 利用回数チェック
    const { allowed, remaining } = incrementInterviewReview();
    setReviewRemaining(remaining);
    setCanReview(remaining > 0);

    if (!allowed) {
      setCanReview(false);
      setPhase("questions");
      return;
    }

    setPhase("reviewing");
    setError(null);

    const qaPairs = questions.map((q) => ({
      question: q.question,
      answer: answers[q.id] ?? "",
    }));

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          careerPath: careerTitle,
          questions: qaPairs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "添削に失敗しました。");
      }

      const data: RichInterviewResult = await res.json();
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "添削に失敗しました。"
      );
      setPhase("answering");
    }
  }, [questions, answers, careerTitle]);

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  // 添削結果をエージェントに共有
  const handleShareReview = useCallback(async () => {
    if (isSharingRef.current) return;
    isSharingRef.current = true;
    setIsSharing(true);

    try {
      const res = await fetch("/api/share-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          careerTitle,
          questions,
          reviewResult: result,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "共有リンクの作成に失敗しました。");
      }

      const data = await res.json();
      const interviewShareUrl = `${window.location.origin}/interview/share/${data.shareId}`;

      const resultShareRaw = localStorage.getItem("lastResultShareUrl");
      const message = [
        "キャリアAIの面接対策結果を共有します。",
        "",
        `🎤 想定質問＆添削結果: ${interviewShareUrl}`,
        ...(resultShareRaw ? [`📊 診断結果: ${resultShareRaw}`] : []),
      ].join("\n");

      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // fallback
      }

      window.open(
        "https://lin.ee/JlpMkfy?utm_source=career-ai&utm_medium=interview-review-share",
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "共有リンクの作成に失敗しました。"
      );
    } finally {
      isSharingRef.current = false;
      setIsSharing(false);
    }
  }, [careerTitle, questions, result]);

  // ---------- 依頼先の選択 ----------
  if (phase === "selecting" && careerTitle) {
    return (
      <main className="min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* ヘッダー */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link href="/result">
              <Button variant="ghost" size="sm" className="gap-1 mb-4">
                <ArrowLeft className="w-4 h-4" />
                結果に戻る
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">面接対策</h1>
            {careerTitle && (
              <p className="text-muted-foreground mt-1">
                「{careerTitle}」の面接対策方法を選択してください
              </p>
            )}
          </motion.div>

          {/* 選択カード */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* LINE（無料） */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <a
                href={LINE_URL_FREE}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                <Card
                  className="h-full border-2 hover:shadow-lg transition-shadow cursor-pointer"
                  style={{ borderColor: "#06C755" }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <LineIcon className="w-6 h-6 text-[#06C755]" />
                      無料で転職エージェントに依頼する
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      プロの転職アドバイザーがLINEであなたの面接対策をサポートします。
                    </p>
                    <Button
                      className="w-full gap-2 text-white"
                      style={{ backgroundColor: "#06C755" }}
                      asChild
                    >
                      <span>
                        <LineIcon className="w-4 h-4" />
                        LINEで無料相談する
                        <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                      </span>
                    </Button>
                  </CardContent>
                </Card>
              </a>
            </motion.div>

            {/* AI面接対策（月1回無料） */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <Card
                className="h-full border-2 border-blue-200 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setPhase("loading")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="w-6 h-6 text-blue-500" />
                    AI面接対策
                    <Badge variant="secondary" className="text-xs">
                      月1回無料
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      想定質問を自動生成
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      質問をURL共有してエージェントに送れる
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      AIが回答を添削（月1回無料）
                    </li>
                  </ul>
                  <Button className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white">
                    <Brain className="w-4 h-4" />
                    AI面接対策を始める
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* LINE説明カード */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <Card className="bg-[#06C755]/5 border-[#06C755]/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle
                    className="w-5 h-5"
                    style={{ color: "#06C755" }}
                  />
                  LINE転職エージェントでできること
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#06C755]/10 flex items-center justify-center flex-shrink-0">
                      <Clock
                        className="w-4 h-4"
                        style={{ color: "#06C755" }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">最短即日対応</p>
                      <p className="text-xs text-muted-foreground">
                        LINEで気軽にいつでも相談OK
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#06C755]/10 flex items-center justify-center flex-shrink-0">
                      <Users
                        className="w-4 h-4"
                        style={{ color: "#06C755" }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">模擬面接</p>
                      <p className="text-xs text-muted-foreground">
                        プロによる実践的な面接練習
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#06C755]/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2
                        className="w-4 h-4"
                        style={{ color: "#06C755" }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">回答添削</p>
                      <p className="text-xs text-muted-foreground">
                        志望動機・自己PRの添削対応
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    );
  }

  // ---------- エラー表示 ----------
  if (error && phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Link href="/result">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                結果ページに戻る
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ---------- ローディング ----------
  if (phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          aria-label="質問を生成中"
        >
          <div className="relative mx-auto w-16 h-16">
            <Brain className="w-16 h-16 text-primary" aria-hidden="true" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2
                className="w-8 h-8 text-primary animate-spin opacity-50"
                aria-hidden="true"
              />
            </div>
          </div>
          <p className="text-muted-foreground">
            面接の想定質問を生成しています...
          </p>
        </motion.div>
      </main>
    );
  }

  // ---------- 質問表示 + 共有 + AI添削導線 ----------
  if (phase === "questions") {
    return (
      <main className="min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* ヘッダー */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link href="/result">
              <Button variant="ghost" size="sm" className="gap-1 mb-4">
                <ArrowLeft className="w-4 h-4" />
                結果に戻る
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">面接 想定質問</h1>
            <p className="text-muted-foreground mt-1">
              「{careerTitle}」の面接で想定される質問
            </p>
          </motion.div>

          {/* 質問一覧（閲覧用） */}
          {questions.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className="flex-shrink-0 mt-0.5"
                    >
                      Q{q.id}
                    </Badge>
                    <span>{q.question}</span>
                  </CardTitle>
                </CardHeader>
              </Card>
            </motion.div>
          ))}

          {/* 質問を共有 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-primary" />
                  質問を共有する
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  転職エージェントにこの質問を共有して、面接対策のアドバイスをもらいましょう。
                </p>

                {!shareUrl ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleShareQuestions}
                    disabled={isSharing}
                  >
                    {isSharing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                    共有リンクを作成
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyUrl}
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full gap-2 text-white"
                  style={{ backgroundColor: "#06C755" }}
                  onClick={handleLineShare}
                >
                  <LineIcon className="w-4 h-4" />
                  LINEで質問を送る
                  <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI添削セクション */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {canReview ? (
              <Card className="border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-500" />
                    AIに回答を添削してもらう
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    各質問に対する回答を入力すると、AIが添削して改善案を提示します。
                  </p>
                  <Button
                    className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                    onClick={() => setPhase("answering")}
                  >
                    <Send className="w-4 h-4" />
                    回答を入力してAIに添削を依頼する
                    <Badge
                      variant="secondary"
                      className="ml-auto text-xs bg-blue-400/20 text-white"
                    >
                      無料 残り{reviewRemaining}回/月
                    </Badge>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="w-5 h-5 text-orange-500" />
                    今月のAI添削無料枠を使い切りました
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    AI添削は月1回無料でご利用いただけます。来月また1回無料で利用できます。
                  </p>
                  <a
                    href={LINE_URL_FREE}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      className="w-full gap-2 text-white"
                      style={{ backgroundColor: "#06C755" }}
                    >
                      <LineIcon className="w-4 h-4" />
                      LINEでプロに添削を依頼する
                      <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                    </Button>
                  </a>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Star className="w-3.5 h-3.5" />
                    <span>
                      プレミアムプラン（無制限）は準備中です
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </main>
    );
  }

  // ---------- 回答入力フェーズ ----------
  if (phase === "answering") {
    return (
      <main className="min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* ヘッダー */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 mb-4"
              onClick={() => setPhase("questions")}
            >
              <ArrowLeft className="w-4 h-4" />
              質問一覧に戻る
            </Button>
            <h1 className="text-2xl font-bold">面接対策</h1>
            <p className="text-muted-foreground mt-1">
              「{careerTitle}」の想定質問に回答してください
            </p>
          </motion.div>

          {/* 質問カード */}
          {questions.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className="flex-shrink-0 mt-0.5"
                    >
                      Q{q.id}
                    </Badge>
                    <span>{q.question}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="あなたの回答を入力してください..."
                    aria-label={`質問${q.id}への回答`}
                    maxLength={2000}
                    rows={4}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* 送信ボタン */}
          <motion.div
            className="flex justify-center pt-4 pb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              size="lg"
              className="gap-2"
              disabled={!allAnswered}
              onClick={handleSubmitReview}
            >
              <Send className="w-4 h-4" />
              添削を依頼する
            </Button>
          </motion.div>
        </div>
      </main>
    );
  }

  // ---------- 添削中 ----------
  if (phase === "reviewing") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">
            AIが回答を添削しています...
          </p>
        </motion.div>
      </main>
    );
  }

  // ---------- 結果表示 ----------
  if (phase === "result" && result) {
    const noRemaining = getInterviewRemaining() === 0;

    return (
      <main className="min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* ヘッダー */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 mb-4"
              onClick={() => setPhase("questions")}
            >
              <ArrowLeft className="w-4 h-4" />
              質問一覧に戻る
            </Button>
            <h1 className="text-2xl font-bold">添削結果</h1>
            <p className="text-muted-foreground mt-1">
              「{careerTitle}」の面接対策
            </p>
          </motion.div>

          {/* 各問の添削結果（リッチUI） */}
          {result.reviews.map((review, i) => (
            <InterviewReviewCard
              key={i}
              question={review.question}
              userAnswer={review.userAnswer}
              reviewData={review.reviewData}
              index={i}
            />
          ))}

          {/* 無料枠使い切り警告 */}
          {noRemaining && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-orange-500" />
                    <p className="text-sm font-medium">
                      今月のAI添削無料枠を使い切りました
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    来月また1回無料で利用できます。さらに添削を受けたい場合はLINEでプロに相談しましょう。
                  </p>
                  <a
                    href={LINE_URL_FREE}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      className="w-full gap-2 text-white"
                      style={{ backgroundColor: "#06C755" }}
                    >
                      <LineIcon className="w-4 h-4" />
                      LINEでプロに添削を依頼する
                      <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* アクションボタン */}
          <motion.div
            className="flex flex-col gap-3 pt-4 pb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <Button
              size="lg"
              className="w-full gap-2 text-white"
              style={{ backgroundColor: "#06C755" }}
              onClick={handleShareReview}
              disabled={isSharing}
            >
              {isSharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <LineIcon className="w-4 h-4" />
              )}
              {copied
                ? "URLがコピーされました"
                : "添削結果をエージェントに共有する"}
            </Button>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setPhase("questions")}
              >
                <ArrowLeft className="w-4 h-4" />
                質問一覧に戻る
              </Button>
              <Link href="/result" className="flex-1">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2"
                >
                  結果ページに戻る
                </Button>
              </Link>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              AI添削 残り {getInterviewRemaining()}/1 回（今月）
            </p>
          </motion.div>
        </div>
      </main>
    );
  }

  return null;
}
