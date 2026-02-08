"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Brain, LinkIcon, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InterviewQuestion } from "@/lib/types";

export default function SharedInterviewPage() {
  const params = useParams();
  const shareId = params.id as string;

  const [careerTitle, setCareerTitle] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
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
              共有された面接質問です
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

        {/* 質問一覧 */}
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
            </Card>
          </motion.div>
        ))}

        {/* CTA */}
        <motion.div
          className="text-center pt-4 pb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Link href="/diagnosis">
            <Button size="lg">自分もキャリア診断をする</Button>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
