"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brain,
  LinkIcon,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Target,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SharedQuestion } from "@/lib/types";

export default function SharedInterviewPage() {
  const params = useParams();
  const shareId = params.id as string;

  const [careerTitle, setCareerTitle] = useState("");
  const [questions, setQuestions] = useState<SharedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          `/api/share-interview?id=${encodeURIComponent(shareId)}`
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "データの取得に失敗しました。");
          return;
        }

        setCareerTitle(data.careerTitle);
        setQuestions(data.questions);
      } catch {
        setError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }

    if (shareId) fetchData();
  }, [shareId]);

  // データ状態の判定
  const hasAnyAnswer = questions.some((q) => q.userAnswer);
  const hasAnyReview = questions.some((q) => q.review);

  // ヘッダーバッジテキスト
  const badgeText = hasAnyReview
    ? "共有された面接対策結果です"
    : hasAnyAnswer
      ? "共有された面接回答です"
      : "共有された面接質問です";

  // ローディング
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div
          role="status"
          aria-label="読み込み中"
          className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
        />
      </main>
    );
  }

  // エラー
  if (error || questions.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <LinkIcon className="w-12 h-12 text-muted-foreground mx-auto" />
              <h1 className="text-lg font-bold">
                このリンクは期限切れか、存在しません
              </h1>
              <p className="text-sm text-muted-foreground">
                {error || "共有データが見つかりませんでした。"}
              </p>
              <p className="text-xs text-muted-foreground">
                共有リンクは作成から90日間有効です。
              </p>
              <Link href="/diagnosis">
                <Button className="mt-2">自分もキャリア診断をする</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ヘッダー */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-center mb-3">
            <Badge variant="outline" className="gap-1.5 px-3 py-1">
              <Share2 className="w-3.5 h-3.5" />
              {badgeText}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            面接対策 想定質問
          </h1>
          <p className="text-muted-foreground">
            「{careerTitle}」の面接で想定される質問
          </p>
        </motion.div>

        {/* 質問一覧（per-question表示） */}
        {questions.map((q, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className="space-y-3"
          >
            {/* 質問 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-start gap-3">
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 mt-0.5"
                  >
                    Q{i + 1}
                  </Badge>
                  <span>{q.question}</span>
                </CardTitle>
              </CardHeader>

              {/* 回答表示 */}
              <CardContent className="pt-0 space-y-3">
                {q.userAnswer ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">📝</span>
                      <span className="text-sm font-medium text-muted-foreground">
                        相談者の回答
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-l-4 border-gray-300 dark:border-gray-700 rounded-r-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                      {q.userAnswer}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    （未回答）
                  </p>
                )}

                {/* 添削結果（コンパクト表示） */}
                {q.review ? (
                  <div className="space-y-3 pt-2 border-t">
                    {/* スコア行 */}
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="text-sm font-bold px-3 py-1"
                        style={{
                          borderColor:
                            q.review.score.total >= 90
                              ? "#22c55e"
                              : q.review.score.total >= 70
                                ? "#3b82f6"
                                : q.review.score.total >= 50
                                  ? "#f97316"
                                  : "#ef4444",
                          color:
                            q.review.score.total >= 90
                              ? "#22c55e"
                              : q.review.score.total >= 70
                                ? "#3b82f6"
                                : q.review.score.total >= 50
                                  ? "#f97316"
                                  : "#ef4444",
                        }}
                      >
                        {q.review.score.total}/100 {q.review.score.grade}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {q.review.score.summary}
                      </span>
                    </div>

                    {/* AI改善案 */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">✨</span>
                        <span className="text-sm font-medium text-muted-foreground">
                          AI改善案
                        </span>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-400 dark:border-blue-700 rounded-r-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                        {q.review.improvedAnswer}
                      </div>
                    </div>

                    {/* 良い点 */}
                    {q.review.goodPoints.length > 0 && (
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm space-y-0.5">
                          {q.review.goodPoints.map((point, j) => (
                            <p key={j} className="text-muted-foreground">
                              {point}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 改善すべき点 */}
                    {q.review.improvementPoints.length > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm space-y-0.5">
                          {q.review.improvementPoints.map((point, j) => (
                            <p key={j} className="text-muted-foreground">
                              <span className="font-medium text-foreground">{point.issue}</span>
                              {" → "}
                              {point.suggestion}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 面接官視点 */}
                    {q.review.interviewerPerspective.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm space-y-0.5">
                          {q.review.interviewerPerspective.map((point, j) => (
                            <p key={j} className="text-muted-foreground">
                              {point}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : q.userAnswer ? (
                  <p className="text-sm text-muted-foreground italic pt-2 border-t flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5" />
                    AI添削なし — エージェントがサポートします
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* 下部メッセージ */}
        <motion.div
          className="space-y-4 text-center pt-4 pb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {hasAnyReview ? (
            <p className="text-sm text-muted-foreground">
              AI添削済みの回答です。さらに詳しいアドバイスはエージェントにご相談ください。
            </p>
          ) : hasAnyAnswer ? (
            <p className="text-sm text-muted-foreground">
              相談者の回答が含まれています。添削やアドバイスをお願いします。
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              想定質問のみ共有されています。回答の準備や模擬面接にご活用ください。
            </p>
          )}

          <Link href="/diagnosis">
            <Button size="lg">キャリアAIで自分も面接対策する</Button>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
