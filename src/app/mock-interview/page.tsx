"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, ArrowLeft, Loader2, FileText, Brain, AlertTriangle, Info, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import PageTransition from "@/components/PageTransition";
import LineShareButton from "@/components/LineShareButton";
import { canUseMockInterview, getMockInterviewRemaining } from "@/lib/chatLimit";
import type { InterviewType } from "@/lib/mock-interview-types";

const INDUSTRY_OPTIONS = [
  "IT・通信", "メーカー", "金融", "コンサル", "商社",
  "サービス", "医療", "不動産", "人材", "その他",
];

const POSITION_OPTIONS = [
  "エンジニア", "営業", "企画", "マーケティング", "人事",
  "経理", "コンサルタント", "デザイナー", "その他",
];

const INTERVIEW_TYPES: { value: InterviewType; label: string; desc: string }[] = [
  { value: "first", label: "一次面接", desc: "人事担当者による基本質問" },
  { value: "second", label: "二次面接", desc: "現場マネージャーによる深掘り" },
  { value: "final", label: "最終面接", desc: "役員面接、志望度・人柄重視" },
];

export default function MockInterviewPage() {
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [position, setPosition] = useState("");
  const [customPosition, setCustomPosition] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("first");
  const [questionCount, setQuestionCount] = useState<5 | 8>(8);
  const [isStarting, setIsStarting] = useState(false);
  const [canUse, setCanUse] = useState(true);
  const [remaining, setRemaining] = useState(1);
  const [hasResumeData, setHasResumeData] = useState(false);
  const [hasDiagnosisData, setHasDiagnosisData] = useState(false);
  const [useCamera, setUseCamera] = useState(true);

  useEffect(() => {
    setCanUse(canUseMockInterview());
    setRemaining(getMockInterviewRemaining());
    try {
      setHasResumeData(!!localStorage.getItem("career-ai-resume-result"));
      setHasDiagnosisData(!!localStorage.getItem("analysisResult"));
    } catch { /* ignore */ }
  }, []);

  const selectedIndustry = industry === "その他" ? customIndustry : industry;
  const selectedPosition = position === "その他" ? customPosition : position;
  const canStart = selectedIndustry && selectedPosition && !isStarting;

  const startInterview = useCallback(async () => {
    setIsStarting(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resumeData: any = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let diagnosisResult: any = null;

      try {
        const resumeRaw = localStorage.getItem("career-ai-resume-result");
        if (resumeRaw) {
          const parsed = JSON.parse(resumeRaw);
          resumeData = {
            workHistory: parsed.formData?.workHistory,
            skills: parsed.formData?.skills,
            selfPR: parsed.formData?.selfPR,
          };
        }
      } catch { /* ignore */ }

      try {
        const diagRaw = localStorage.getItem("analysisResult");
        if (diagRaw) diagnosisResult = JSON.parse(diagRaw);
      } catch { /* ignore */ }

      const res = await fetch("/api/mock-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            industry: selectedIndustry,
            position: selectedPosition,
            interviewType,
            questionCount,
          },
          resumeData,
          diagnosisResult,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "面接の開始に失敗しました");
      }

      const data = await res.json();

      localStorage.setItem("career-ai-mock-session", JSON.stringify({
        ...data,
        useCamera,
      }));

      window.location.href = `/mock-interview/session?sessionId=${data.sessionId}`;
    } catch (err) {
      alert(err instanceof Error ? err.message : "面接の開始に失敗しました");
    } finally {
      setIsStarting(false);
    }
  }, [selectedIndustry, selectedPosition, interviewType, questionCount, useCamera]);

  const handleStart = async () => {
    if (!canStart) return;
    await startInterview();
  };

  // 利用制限に達している場合
  if (!canUse) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen py-10 px-4">
          <div className="max-w-xl mx-auto space-y-6">
            <Link href="/interview" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              面接対策に戻る
            </Link>

            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
                <h1 className="text-lg font-bold">今月の無料枠を使い切りました</h1>
                <p className="text-sm text-muted-foreground">
                  AI模擬面接は月1回まで無料でご利用いただけます。
                  プレミアムプランなら無制限で練習できます。
                </p>
                <div className="pt-2">
                  <LineShareButton
                    context="mock-interview"
                    label="LINEでエージェントに相談する"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <Link href="/interview" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="w-4 h-4" />
              面接対策に戻る
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              AI模擬面接
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AIが面接官になって、テキストチャット形式で面接練習ができます
            </p>
          </div>

          {/* データ検出バナー */}
          {(hasResumeData || hasDiagnosisData) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              {hasResumeData && (
                <Badge variant="outline" className="gap-1.5 w-fit">
                  <FileText className="w-3.5 h-3.5" />
                  履歴書のデータを面接に反映します
                </Badge>
              )}
              {hasDiagnosisData && (
                <Badge variant="outline" className="gap-1.5 w-fit">
                  <Brain className="w-3.5 h-3.5" />
                  診断結果を面接に反映します
                </Badge>
              )}
            </motion.div>
          )}

          {/* Settings Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">面接設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Industry */}
              <div className="space-y-2">
                <label className="text-sm font-medium">志望業界</label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger><SelectValue placeholder="業界を選択" /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
                {industry === "その他" && (
                  <Input placeholder="業界を入力" value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} />
                )}
              </div>

              {/* Position */}
              <div className="space-y-2">
                <label className="text-sm font-medium">志望職種</label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger><SelectValue placeholder="職種を選択" /></SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
                {position === "その他" && (
                  <Input placeholder="職種を入力" value={customPosition} onChange={e => setCustomPosition(e.target.value)} />
                )}
              </div>

              {/* Interview Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">面接タイプ</label>
                <div className="space-y-2">
                  {INTERVIEW_TYPES.map(t => (
                    <label
                      key={t.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        interviewType === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="interviewType"
                        value={t.value}
                        checked={interviewType === t.value}
                        onChange={() => setInterviewType(t.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Question Count */}
              <div className="space-y-2">
                <label className="text-sm font-medium">質問数</label>
                <div className="flex gap-3">
                  {([5, 8] as const).map(n => (
                    <label
                      key={n}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-center ${
                        questionCount === n ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="questionCount"
                        value={n}
                        checked={questionCount === n}
                        onChange={() => setQuestionCount(n)}
                        className="sr-only"
                      />
                      <div>
                        <p className="text-sm font-medium">{n}問</p>
                        <p className="text-xs text-muted-foreground">{n === 5 ? "約10分" : "約15分"}</p>
                        {n === 8 && <Badge variant="secondary" className="text-[10px] mt-1">おすすめ</Badge>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Camera Toggle */}
              <div className="space-y-2">
                <label className="text-sm font-medium">カメラ設定</label>
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    useCamera ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={useCamera}
                    onChange={(e) => setUseCamera(e.target.checked)}
                    className="sr-only"
                  />
                  <div className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0" style={{ backgroundColor: useCamera ? "hsl(var(--primary))" : "hsl(var(--muted))" }}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${useCamera ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {useCamera ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                      {useCamera ? "カメラON（オンライン面接形式）" : "カメラOFF"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {useCamera ? "本番に近い緊張感で練習できます" : "カメラなしでチャットのみの面接練習"}
                    </p>
                  </div>
                </label>
              </div>

              {/* Start Button */}
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handleStart}
                disabled={!canStart}
              >
                {isStarting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                {isStarting ? "面接を準備中..." : "模擬面接を開始する"}
              </Button>

              {/* Notes */}
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <p>テキストチャット形式で面接を進めます</p>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <p>各質問に2分の回答時間があります</p>
                </div>
                {remaining !== Infinity && (
                  <p className="text-muted-foreground">
                    今月の残り回数: {remaining}回
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </PageTransition>
  );
}
