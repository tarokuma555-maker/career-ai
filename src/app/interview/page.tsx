"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brain,
  Loader2,
  ArrowLeft,
  Send,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Star,
  Clock,
  Users,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import type {
  InterviewQuestion,
  InterviewResult,
  CareerPath,
} from "@/lib/types";

const LINE_URL_FREE =
  "https://lin.ee/JlpMkfy?utm_source=career-ai&utm_medium=interview";
const LINE_URL_PAID_PENDING =
  "https://lin.ee/JlpMkfy?utm_source=career-ai&utm_medium=interview-paid-pending";

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

const scoreColor = (score: number) =>
  score >= 80
    ? "bg-green-500"
    : score >= 60
      ? "bg-yellow-500"
      : "bg-orange-500";

const scoreBadgeVariant = (score: number) =>
  score >= 80
    ? "text-green-700 bg-green-100 border-green-300"
    : score >= 60
      ? "text-yellow-700 bg-yellow-100 border-yellow-300"
      : "text-orange-700 bg-orange-100 border-orange-300";

type Phase = "selecting" | "loading" | "answering" | "reviewing" | "result";

export default function InterviewPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("selecting");
  const [careerTitle, setCareerTitle] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaidDialog, setShowPaidDialog] = useState(false);

  // localStorage読み取り
  useEffect(() => {
    const target = localStorage.getItem("interviewTarget");
    if (!target) {
      router.replace("/result");
      return;
    }
    setCareerTitle(target);
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
        setPhase("answering");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "質問の生成に失敗しました。"
        );
      }
    }

    generateQuestions();
  }, [phase, careerTitle]);

  // 回答添削
  const handleSubmitReview = useCallback(async () => {
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

      const data: InterviewResult = await res.json();
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
                <Card className="h-full border-2 hover:shadow-lg transition-shadow cursor-pointer"
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

            {/* AI（有料） */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <Card
                className="h-full border-2 border-blue-200 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setShowPaidDialog(true)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="w-6 h-6 text-blue-500" />
                    有料でAIに依頼する
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    AIが想定質問を生成し、あなたの回答をリアルタイムで添削します。
                  </p>
                  <Button className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white">
                    <Brain className="w-4 h-4" />
                    AIで面接対策をする
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
                  <MessageCircle className="w-5 h-5" style={{ color: "#06C755" }} />
                  LINE転職エージェントでできること
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#06C755]/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4" style={{ color: "#06C755" }} />
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
                      <Users className="w-4 h-4" style={{ color: "#06C755" }} />
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
                      <CheckCircle2 className="w-4 h-4" style={{ color: "#06C755" }} />
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

        {/* 有料AI準備中ダイアログ */}
        <Dialog open={showPaidDialog} onOpenChange={setShowPaidDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-blue-500" />
                AI面接対策（準備中）
              </DialogTitle>
              <DialogDescription>
                有料AI面接対策は現在準備中です。
                公式LINEに登録いただくとリリース時にお知らせします。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <a
                href={LINE_URL_PAID_PENDING}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  className="w-full gap-2 text-white"
                  style={{ backgroundColor: "#06C755" }}
                >
                  <LineIcon className="w-4 h-4" />
                  公式LINEに登録する
                  <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                </Button>
              </a>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowPaidDialog(false)}
              >
                閉じる
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
              <Loader2 className="w-8 h-8 text-primary animate-spin opacity-50" aria-hidden="true" />
            </div>
          </div>
          <p className="text-muted-foreground">
            面接の想定質問を生成しています...
          </p>
        </motion.div>
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
            <Link href="/result">
              <Button variant="ghost" size="sm" className="gap-1 mb-4">
                <ArrowLeft className="w-4 h-4" />
                結果に戻る
              </Button>
            </Link>
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
            <h1 className="text-2xl font-bold">添削結果</h1>
            <p className="text-muted-foreground mt-1">
              「{careerTitle}」の面接対策
            </p>
          </motion.div>

          {/* 総合スコア */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">総合スコア</h2>
                  <span
                    className={`text-3xl font-bold ${
                      result.overall_score >= 80
                        ? "text-green-600"
                        : result.overall_score >= 60
                          ? "text-yellow-600"
                          : "text-orange-600"
                    }`}
                  >
                    {result.overall_score}
                    <span className="text-base text-muted-foreground">
                      /100
                    </span>
                  </span>
                </div>
                <Progress
                  value={result.overall_score}
                  className="h-3 mb-4"
                />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {result.overall_advice}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* 各問の添削結果 */}
          {result.reviews.map((review, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.3 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base flex items-start gap-3">
                      <Badge
                        variant="outline"
                        className="flex-shrink-0 mt-0.5"
                      >
                        Q{i + 1}
                      </Badge>
                      <span>{review.question}</span>
                    </CardTitle>
                    <Badge
                      className={`flex-shrink-0 border ${scoreBadgeVariant(review.score)}`}
                    >
                      {review.score}点
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Before */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-orange-400" />
                      <span className="text-sm font-medium text-muted-foreground">
                        あなたの回答
                      </span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {review.original_answer}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
                  </div>

                  {/* After */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-sm font-medium text-muted-foreground">
                        改善例
                      </span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {review.improved_answer}
                    </div>
                  </div>

                  {/* フィードバック */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">
                        フィードバック
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {review.feedback}
                    </p>
                  </div>

                  {/* スコアバー */}
                  <div className="pt-1">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>スコア</span>
                      <span>{review.score}/100</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${scoreColor(review.score)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${review.score}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* アクションボタン */}
          <motion.div
            className="flex flex-col sm:flex-row justify-center gap-3 pt-4 pb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setAnswers({});
                setResult(null);
                setPhase("answering");
              }}
            >
              もう一度回答する
            </Button>
            <Link href="/result">
              <Button size="lg" variant="outline" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                結果ページに戻る
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>
    );
  }

  return null;
}
