"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  Target,
  ArrowRight,
  ArrowDown,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReviewData } from "@/lib/types";

// ---------- 円形スコア（アニメーション付き） ----------
function AnimatedCircularScore({
  score,
  grade,
}: {
  score: number;
  grade: string;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    let frame: number;
    const duration = 1500;
    const start = performance.now();
    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <defs>
          <linearGradient id={`review-score-grad-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={`url(#review-score-grad-${score})`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--accent-blue)]">
          {animatedScore}
        </span>
        <span className="text-xs text-muted-foreground">/100</span>
        <Badge
          variant="outline"
          className="mt-1 text-xs font-bold border-[var(--accent-blue)] text-[var(--accent-blue)]"
        >
          {grade}
        </Badge>
      </div>
    </div>
  );
}

// ---------- 内訳バー ----------
function BreakdownBar({
  label,
  score,
  delay,
}: {
  label: string;
  score: number;
  delay: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-accent-gradient"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ---------- メインコンポーネント ----------
interface InterviewReviewResultProps {
  question: string;
  userAnswer: string;
  reviewData: ReviewData;
  index: number;
  readOnly?: boolean;
}

export default function InterviewReviewResult({
  question,
  userAnswer,
  reviewData,
  index,
  readOnly = false,
}: InterviewReviewResultProps) {
  const { score, improvedAnswer, changes, goodPoints, improvementPoints, interviewerPerspective } =
    reviewData;

  const scoreBg =
    score.total >= 90
      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30"
      : score.total >= 70
        ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30"
        : score.total >= 50
          ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30"
          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30";

  const baseDelay = index * 0.3;

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4 }}
    >
      {/* 質問ヘッダー */}
      <div className="flex items-start gap-3">
        <Badge variant="outline" className="flex-shrink-0 mt-0.5 text-sm px-3 py-1">
          Q{index + 1}
        </Badge>
        <h3 className="text-base font-medium">{question}</h3>
      </div>

      {/* セクション1: 総合スコア */}
      <Card className={`border ${scoreBg}`}>
        <CardContent className="pt-6 space-y-6">
          <AnimatedCircularScore score={score.total} grade={score.grade} />
          <p className="text-sm text-center text-muted-foreground">
            {score.summary}
          </p>

          {/* 内訳 */}
          <div className="space-y-3">
            {Object.entries(score.breakdown).map(([key, item], i) => (
              <BreakdownBar
                key={key}
                label={item.label}
                score={item.score}
                delay={baseDelay + 0.3 + i * 0.2}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* セクション2: Before / After */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Before */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: baseDelay + 0.4, duration: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">📝</span>
                <span className="text-sm font-medium text-muted-foreground">
                  あなたの回答
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 border-l-4 border-gray-300 dark:border-gray-700 rounded-r-lg p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-[120px]">
                {userAnswer}
              </div>
            </motion.div>

            {/* 矢印 */}
            <div className="flex md:hidden justify-center py-1">
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
            </div>

            {/* After */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: baseDelay + 0.5, duration: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">✨</span>
                <span className="text-sm font-medium text-muted-foreground">
                  AI改善案
                </span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-400 dark:border-blue-700 rounded-r-lg p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-[120px]">
                {improvedAnswer}
              </div>
            </motion.div>
          </div>

          {/* PC用矢印（中央） */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>

          {/* 変更ハイライト */}
          {changes.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                変更ハイライト
              </p>
              <div className="space-y-1.5">
                {changes.map((change, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {change.type === "added" && (
                      <>
                        <Plus className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-green-700 dark:text-green-400">
                          追加: {change.description}
                        </span>
                      </>
                    )}
                    {change.type === "improved" && (
                      <>
                        <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <span className="text-yellow-700 dark:text-yellow-400">
                          改善: {change.description}
                        </span>
                      </>
                    )}
                    {change.type === "removed" && (
                      <>
                        <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-center text-red-500 text-xs leading-4">
                          ✕
                        </span>
                        <span className="text-red-700 dark:text-red-400">
                          削除: {change.description}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* セクション3: 改善ポイント */}
      <div className="space-y-3">
        {/* 良い点 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.6, duration: 0.3 }}
        >
          <Card className="bg-green-50/50 dark:bg-green-950/10 border-l-4 border-l-green-500">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                良い点
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ul className="space-y-1.5">
                {goodPoints.map((point, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* 改善すべき点 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.9, duration: 0.3 }}
        >
          <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-l-4 border-l-orange-500">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                改善すべき点
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ul className="space-y-3">
                {improvementPoints.map((point, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-medium text-foreground">{point.issue}</p>
                    <p className="text-muted-foreground mt-0.5">
                      → {point.suggestion}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* 面接官が見ているポイント */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 1.2, duration: 0.3 }}
        >
          <Card className="bg-purple-50/50 dark:bg-purple-950/10 border-l-4 border-l-purple-500">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                面接官が見ているポイント
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-xs text-muted-foreground mb-2">
                この質問で面接官は以下を評価しています:
              </p>
              <ul className="space-y-1.5">
                {interviewerPerspective.map((point, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <Target className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 区切り線（最後の質問以外） */}
      {!readOnly && (
        <div className="border-b border-dashed pt-2" />
      )}
    </motion.div>
  );
}
