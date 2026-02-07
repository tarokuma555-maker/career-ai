"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult, CareerPath } from "@/lib/types";

// ---------- 円形プログレス ----------
function CircularScore({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80
      ? "text-green-500 stroke-green-500"
      : score >= 60
        ? "text-yellow-500 stroke-yellow-500"
        : "text-orange-500 stroke-orange-500";

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
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
          className={color}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${color.split(" ")[0]}`}>
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
          className="absolute h-full rounded-full bg-primary/70"
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
}: {
  path: CareerPath;
  index: number;
}) {
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
                      <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
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
  }, [router]);

  if (!result) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // レーダーチャート用データ
  const allSkillKeys = Array.from(
    new Set([
      ...Object.keys(result.skill_analysis.current_skills),
      ...Object.keys(result.skill_analysis.target_skills),
    ])
  );
  const radarData = allSkillKeys.map((skill) => ({
    skill,
    現在: result.skill_analysis.current_skills[skill] ?? 0,
    目標: result.skill_analysis.target_skills[skill] ?? 0,
  }));

  // ユーザー情報サマリー
  const diagRaw = localStorage.getItem("diagnosisData");
  const diag = diagRaw ? JSON.parse(diagRaw) : null;

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ヘッダー */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold mb-2">
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
              <CareerPathCard key={path.title} path={path} index={i} />
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
          <Card className="bg-primary/5 border-primary/20">
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

        {/* アクションボタン */}
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-3 pt-4 pb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
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
            disabled
            title="今後実装予定"
          >
            <FileDown className="w-4 h-4" />
            結果をPDFで保存
          </Button>
          <Link href="/diagnosis">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              もう一度診断する
            </Button>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
