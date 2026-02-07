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
import { Progress } from "@/components/ui/progress";
import type {
  InterviewQuestion,
  InterviewResult,
  CareerPath,
} from "@/lib/types";

type Phase = "loading" | "answering" | "reviewing" | "result";

export default function InterviewPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [careerTitle, setCareerTitle] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 質問生成
  useEffect(() => {
    const target = localStorage.getItem("interviewTarget");
    if (!target) {
      router.replace("/result");
      return;
    }
    setCareerTitle(target);

    // キャリアパスの詳細を取得
    let careerDetail = "";
    const analysisRaw = localStorage.getItem("analysisResult");
    if (analysisRaw) {
      try {
        const analysis = JSON.parse(analysisRaw);
        const matched = analysis.career_paths?.find(
          (p: CareerPath) => p.title === target
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
            careerPath: target,
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
  }, [router]);

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
        >
          <div className="relative mx-auto w-16 h-16">
            <Brain className="w-16 h-16 text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin opacity-50" />
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
