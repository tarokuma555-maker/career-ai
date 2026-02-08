"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brain,
  ArrowLeft,
  Send,
  CheckCircle2,
  Star,
  Clock,
  Users,
  MessageCircle,
  Lock,
  Info,
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
import PageTransition from "@/components/PageTransition";
import AIThinking from "@/components/AIThinking";
import LineShareButton, { LineIcon } from "@/components/LineShareButton";
import type {
  InterviewQuestion,
  RichInterviewResult,
  CareerPath,
  SharedQuestion,
  ReviewData,
} from "@/lib/types";
import type { ShareUrls } from "@/lib/lineShare";
import {
  canUseInterviewReview,
  getInterviewRemaining,
  incrementInterviewReview,
} from "@/lib/chatLimit";

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
  const [shareId, setShareId] = useState<string | null>(null);

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

  // ---------- 共有データを構築 ----------
  const buildSharedQuestions = useCallback((): SharedQuestion[] => {
    const reviewMap = new Map<string, ReviewData>();
    if (result) {
      for (const r of result.reviews) {
        reviewMap.set(r.question, r.reviewData);
      }
    }

    return questions.map((q) => ({
      question: q.question,
      userAnswer: answers[q.id]?.trim() || null,
      review: reviewMap.get(q.question) ?? null,
    }));
  }, [questions, answers, result]);

  // ---------- 共有URL作成/更新 → ShareUrls を返す ----------
  const shareIdRef = useRef<string | null>(null);
  shareIdRef.current = shareId;

  const createOrUpdateInterviewShare = useCallback(async (): Promise<ShareUrls> => {
    const sharedQuestions = buildSharedQuestions();
    let currentShareId = shareIdRef.current;

    if (currentShareId) {
      const res = await fetch("/api/share-interview", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId: currentShareId,
          careerTitle,
          questions: sharedQuestions,
        }),
      });
      if (!res.ok) currentShareId = null;
    }

    if (!currentShareId) {
      const res = await fetch("/api/share-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          careerTitle,
          questions: sharedQuestions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "共有リンクの作成に失敗しました。");
      }

      const data = await res.json();
      currentShareId = data.shareId;
      setShareId(currentShareId);
    }

    const interviewShareUrl = `${window.location.origin}/interview/share/${currentShareId}`;
    const resultShareUrl = localStorage.getItem("career-ai-share-url") || undefined;

    return { interviewShareUrl, resultShareUrl };
  }, [buildSharedQuestions, careerTitle]);

  // 回答添削
  const handleSubmitReview = useCallback(async () => {
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

  const hasAnyAnswer =
    questions.length > 0 &&
    questions.some((q) => (answers[q.id] ?? "").trim().length > 0);

  // ---------- 依頼先の選択 ----------
  if (phase === "selecting" && careerTitle) {
    return (
      <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
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
            <h1 className="text-2xl font-bold font-heading">面接対策</h1>
            {careerTitle && (
              <p className="text-muted-foreground mt-1">
                「{careerTitle}」の面接対策方法を選択してください
              </p>
            )}
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* LINE */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <Card
                className="h-full border-2 hover:shadow-lg transition-shadow"
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
                  <LineShareButton
                    context="interview"
                    label="LINEで無料相談する"
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* AI */}
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
                  <Button className="w-full gap-2">
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
                      <p className="text-xs text-muted-foreground">LINEで気軽にいつでも相談OK</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#06C755]/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4" style={{ color: "#06C755" }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">模擬面接</p>
                      <p className="text-xs text-muted-foreground">プロによる実践的な面接練習</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#06C755]/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" style={{ color: "#06C755" }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">回答添削</p>
                      <p className="text-xs text-muted-foreground">志望動機・自己PRの添削対応</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
      </PageTransition>
    );
  }

  // ---------- エラー表示 ----------
  if (error && phase === "loading") {
    return (
      <PageTransition>
      <main className="relative z-10 min-h-screen flex items-center justify-center px-4">
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
      </PageTransition>
    );
  }

  // ---------- ローディング ----------
  if (phase === "loading") {
    return (
      <PageTransition>
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4" role="status" aria-label="質問を生成中">
          <AIThinking text="面接の想定質問を生成しています..." />
        </div>
      </main>
      </PageTransition>
    );
  }

  // ---------- 質問表示 + 共有 + AI添削導線 ----------
  if (phase === "questions") {
    return (
      <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Link href="/result">
              <Button variant="ghost" size="sm" className="gap-1 mb-4">
                <ArrowLeft className="w-4 h-4" />
                結果に戻る
              </Button>
            </Link>
            <h1 className="text-2xl font-bold font-heading">面接 想定質問</h1>
            <p className="text-muted-foreground mt-1">
              「{careerTitle}」の面接で想定される質問
            </p>
          </motion.div>

          {/* 質問一覧 */}
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
                    <Badge variant="outline" className="flex-shrink-0 mt-0.5">Q{q.id}</Badge>
                    <span>{q.question}</span>
                  </CardTitle>
                </CardHeader>
              </Card>
            </motion.div>
          ))}

          {/* 質問を共有 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  質問を共有する
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  転職エージェントにこの質問を共有して、面接対策のアドバイスをもらいましょう。
                </p>
                <LineShareButton
                  context="interview"
                  onShare={createOrUpdateInterviewShare}
                  label="LINEで質問をエージェントに送る"
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* AI添削セクション */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
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
                    className="w-full gap-2"
                    onClick={() => setPhase("answering")}
                  >
                    <Send className="w-4 h-4" />
                    回答を入力してAIに添削を依頼する
                    <Badge variant="secondary" className="ml-auto text-xs bg-blue-400/20 text-white">
                      無料 残り{reviewRemaining}回/月
                    </Badge>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* 制限画面 */
              <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
                <CardContent className="pt-6 space-y-4">
                  <div className="text-center space-y-2">
                    <Lock className="w-8 h-8 text-orange-500 mx-auto" />
                    <h3 className="font-bold">AI添削の無料回数を使い切りました</h3>
                  </div>

                  {hasAnyAnswer && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-white dark:bg-muted/30 rounded-lg p-3">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                      <span>回答はそのまま残っています。エージェントに共有して、プロの添削を受けることもできます。</span>
                    </div>
                  )}

                  {/* LINE共有カード */}
                  <Card className="border-[#06C755]/30">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-[#06C755]" />
                        <p className="text-sm font-medium">質問と回答をエージェントに共有</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        あなたの回答をプロのアドバイザーがLINEで添削＆面接対策します
                      </p>
                      <LineShareButton
                        context="interview-limit"
                        onShare={createOrUpdateInterviewShare}
                        label="LINEで無料相談する"
                      />
                    </CardContent>
                  </Card>

                  {/* プレミアムカード */}
                  <Card className="border-blue-200">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-blue-500" />
                        <p className="text-sm font-medium">プレミアムで無制限にAI添削</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        月額¥980で全質問をAIが添削
                      </p>
                      <Button className="w-full gap-2" disabled>
                        <Star className="w-4 h-4" />
                        プレミアムに加入する（準備中）
                      </Button>
                    </CardContent>
                  </Card>

                  <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                    <Info className="w-3 h-3" />
                    無料回数は毎月1日にリセットされます
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </main>
      </PageTransition>
    );
  }

  // ---------- 回答入力フェーズ ----------
  if (phase === "answering") {
    return (
      <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 mb-4"
              onClick={() => setPhase("questions")}
            >
              <ArrowLeft className="w-4 h-4" />
              質問一覧に戻る
            </Button>
            <h1 className="text-2xl font-bold font-heading">面接対策</h1>
            <p className="text-muted-foreground mt-1">
              「{careerTitle}」の想定質問に回答してください
            </p>
          </motion.div>

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
                    <Badge variant="outline" className="flex-shrink-0 mt-0.5">Q{q.id}</Badge>
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
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* 送信 + 共有リンク */}
          <motion.div
            className="space-y-4 pt-4 pb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex justify-center">
              <Button
                size="lg"
                className="gap-2"
                disabled={!allAnswered}
                onClick={handleSubmitReview}
              >
                <Send className="w-4 h-4" />
                添削を依頼する
              </Button>
            </div>
            {hasAnyAnswer && (
              <div className="flex justify-center">
                <LineShareButton
                  context="interview"
                  onShare={createOrUpdateInterviewShare}
                  compact
                  label="ここまでの内容をエージェントに共有する"
                />
              </div>
            )}
          </motion.div>
        </div>
      </main>
      </PageTransition>
    );
  }

  // ---------- 添削中 ----------
  if (phase === "reviewing") {
    return (
      <PageTransition>
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <AIThinking text="AIが回答を添削しています..." />
        </div>
      </main>
      </PageTransition>
    );
  }

  // ---------- 結果表示 ----------
  if (phase === "result" && result) {
    const noRemaining = getInterviewRemaining() === 0;

    return (
      <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 mb-4"
              onClick={() => setPhase("questions")}
            >
              <ArrowLeft className="w-4 h-4" />
              質問一覧に戻る
            </Button>
            <h1 className="text-2xl font-bold font-heading">添削結果</h1>
            <p className="text-muted-foreground mt-1">「{careerTitle}」の面接対策</p>
          </motion.div>

          {/* リッチUI */}
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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-orange-500" />
                    <p className="text-sm font-medium">今月のAI添削無料枠を使い切りました</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    来月また1回無料で利用できます。さらに添削を受けたい場合はLINEでプロに相談しましょう。
                  </p>
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
            <LineShareButton
              context="interview-review"
              onShare={createOrUpdateInterviewShare}
              label="添削結果をエージェントに共有する"
            />
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
                <Button size="lg" variant="outline" className="w-full gap-2">
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
      </PageTransition>
    );
  }

  return null;
}
