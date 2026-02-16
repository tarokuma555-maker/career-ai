"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  User,
  FileText,
  ScrollText,
  Brain,
  MessageCircle,
  LinkIcon,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageTransition from "@/components/PageTransition";
import type { ProfileShareData, GeneratedResumeData, GeneratedCVData } from "@/lib/resume-types";

export default function ProfileSharePage() {
  const params = useParams();
  const shareId = params.id as string;

  const [data, setData] = useState<ProfileShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/profile/share?id=${encodeURIComponent(shareId)}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "データの取得に失敗しました。");
          return;
        }
        setData(json);
      } catch {
        setError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }
    if (shareId) fetchData();
  }, [shareId]);

  if (loading) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center">
          <div role="status" aria-label="読み込み中" className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </PageTransition>
    );
  }

  if (error || !data) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="max-w-md w-full">
              <CardContent className="pt-6 text-center space-y-4">
                <LinkIcon className="w-12 h-12 text-muted-foreground mx-auto" />
                <h1 className="text-lg font-bold font-heading">このリンクは期限切れか、存在しません</h1>
                <p className="text-sm text-muted-foreground">{error || "共有データが見つかりませんでした。"}</p>
                <p className="text-xs text-muted-foreground">共有リンクは作成から90日間有効です。</p>
                <Link href="/diagnosis">
                  <Button className="mt-2">自分もキャリア診断をする</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </PageTransition>
    );
  }

  const hasBasicInfo = !!data.basicInfo;
  const hasResume = !!data.generatedResume;
  const hasCV = !!data.generatedCV;
  const hasDiagnosis = !!data.diagnosisShareId;
  const hasInterview = !!data.interviewShareId;

  // Determine available tabs
  const tabs: { value: string; label: string; icon: React.ReactNode }[] = [];
  if (hasBasicInfo) tabs.push({ value: "basic", label: "基本情報", icon: <User className="w-4 h-4" /> });
  if (hasResume || hasCV) tabs.push({ value: "documents", label: "書類データ", icon: <FileText className="w-4 h-4" /> });
  if (hasDiagnosis) tabs.push({ value: "diagnosis", label: "キャリア診断結果", icon: <Brain className="w-4 h-4" /> });
  if (hasInterview) tabs.push({ value: "interview", label: "面接対策", icon: <MessageCircle className="w-4 h-4" /> });

  if (tabs.length === 0) {
    tabs.push({ value: "basic", label: "基本情報", icon: <User className="w-4 h-4" /> });
  }

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-center mb-3">
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <Share2 className="w-3.5 h-3.5" />
                共有されたプロフィールです
              </Badge>
            </div>
            <h1 className="text-2xl font-bold font-heading mb-2">
              {hasBasicInfo ? `${data.basicInfo!.lastName} ${data.basicInfo!.firstName}` : "プロフィール"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Career Planning で作成されたプロフィール情報
            </p>
          </motion.div>

          {/* Tabs */}
          <Tabs defaultValue={tabs[0].value} className="w-full">
            <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
              {tabs.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs sm:text-sm">
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              {hasBasicInfo ? (
                <BasicInfoSection info={data.basicInfo!} />
              ) : (
                <EmptySection text="基本情報はありません" />
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4 mt-4">
              {hasResume && (
                <ResumeSection data={data.generatedResume!} />
              )}
              {hasCV && (
                <CVSection data={data.generatedCV!} />
              )}
              {!hasResume && !hasCV && (
                <EmptySection text="書類データはありません" />
              )}
            </TabsContent>

            {/* Diagnosis Tab */}
            <TabsContent value="diagnosis" className="space-y-4 mt-4">
              {hasDiagnosis ? (
                <Card>
                  <CardContent className="pt-6 text-center space-y-3">
                    <Brain className="w-10 h-10 text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">キャリア診断結果が共有されています</p>
                    <Link href={`/result/share/${data.diagnosisShareId}`}>
                      <Button variant="outline" className="gap-2">
                        <Brain className="w-4 h-4" />
                        診断結果を見る
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <EmptySection text="キャリア診断結果はありません" />
              )}
            </TabsContent>

            {/* Interview Tab */}
            <TabsContent value="interview" className="space-y-4 mt-4">
              {hasInterview ? (
                <Card>
                  <CardContent className="pt-6 text-center space-y-3">
                    <MessageCircle className="w-10 h-10 text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">面接対策データが共有されています</p>
                    <Link href={`/interview/share/${data.interviewShareId}`}>
                      <Button variant="outline" className="gap-2">
                        <MessageCircle className="w-4 h-4" />
                        面接対策を見る
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <EmptySection text="面接対策データはありません" />
              )}
            </TabsContent>
          </Tabs>

          {/* CTA */}
          <motion.div
            className="text-center pt-4 pb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Link href="/diagnosis">
              <Button size="lg">自分もキャリア診断をする</Button>
            </Link>
          </motion.div>
        </div>
      </main>
    </PageTransition>
  );
}

// ---------- Sub Components ----------

function EmptySection({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function BasicInfoSection({ info }: { info: NonNullable<ProfileShareData["basicInfo"]> }) {
  const rows = [
    { label: "氏名", value: `${info.lastName} ${info.firstName}（${info.lastNameKana} ${info.firstNameKana}）` },
    { label: "生年月日", value: info.birthdate },
    { label: "性別", value: info.gender },
    { label: "住所", value: info.address },
    { label: "電話番号", value: info.phone },
    { label: "メール", value: info.email },
  ];

  const prefRows = [
    { label: "希望業界", value: info.preferences.industry },
    { label: "希望職種", value: info.preferences.position },
    { label: "希望年収", value: info.preferences.salary },
    { label: "希望勤務地", value: info.preferences.location },
    { label: "転職時期", value: info.preferences.startDate },
  ].filter(r => r.value);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            基本情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {rows.map(r => r.value && (
              <div key={r.label}>
                <span className="text-muted-foreground">{r.label}: </span>
                {r.value}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {prefRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">希望条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {prefRows.map(r => (
                <div key={r.label}>
                  <span className="text-muted-foreground">{r.label}: </span>
                  {r.value}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ResumeSection({ data }: { data: GeneratedResumeData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          履歴書
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Personal */}
        <div className="text-sm">
          <p className="font-medium mb-1">{data.personalInfo.name}（{data.personalInfo.nameKana}）</p>
          <p className="text-muted-foreground">{data.personalInfo.birthdate}（{data.personalInfo.age}歳）</p>
          <p className="text-muted-foreground">{data.personalInfo.address}</p>
        </div>

        {/* Education */}
        {data.education.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">学歴</p>
            <div className="space-y-1">
              {data.education.map((e, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground w-20 flex-shrink-0">{e.yearMonth}</span>
                  <span>{e.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Work */}
        {data.workHistory.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">職歴</p>
            <div className="space-y-1">
              {data.workHistory.map((w, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground w-20 flex-shrink-0">{w.yearMonth}</span>
                  <span>{w.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Qualifications */}
        {data.qualifications.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">資格・免許</p>
            <div className="space-y-1">
              {data.qualifications.map((q, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground w-20 flex-shrink-0">{q.yearMonth}</span>
                  <span>{q.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Self PR */}
        {data.selfPR && (
          <div>
            <p className="text-sm font-medium mb-2">自己PR</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.selfPR}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CVSection({ data }: { data: GeneratedCVData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-primary" />
          職務経歴書
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {data.summary && (
          <div>
            <p className="text-sm font-medium mb-2">職務要約</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.summary}</p>
          </div>
        )}

        {/* Work History */}
        {data.workHistory.map((w, i) => (
          <div key={i} className="border-t pt-3 first:border-0 first:pt-0">
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm font-medium">{w.company}</p>
              <span className="text-xs text-muted-foreground">{w.period}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {w.department}{w.position ? ` / ${w.position}` : ""} ({w.employmentType})
            </p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">{w.responsibilities}</p>
            {w.achievements.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">実績・成果</p>
                <ul className="space-y-0.5">
                  {w.achievements.map((a, j) => (
                    <li key={j} className="text-sm text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5 flex-shrink-0">-</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {/* Skills */}
        <div>
          <p className="text-sm font-medium mb-2">スキル</p>
          {data.skills.technical.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">技術スキル</p>
              <div className="flex flex-wrap gap-1">
                {data.skills.technical.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
              </div>
            </div>
          )}
          {data.skills.business.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">ビジネススキル</p>
              <div className="flex flex-wrap gap-1">
                {data.skills.business.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
              </div>
            </div>
          )}
          {data.skills.languages.length > 0 && (
            <p className="text-sm text-muted-foreground">語学: {data.skills.languages.join("、")}</p>
          )}
        </div>

        {/* Self PR */}
        {data.selfPR && (
          <div>
            <p className="text-sm font-medium mb-2">自己PR</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.selfPR}</p>
          </div>
        )}

        {/* Motivation */}
        {data.motivation && (
          <div>
            <p className="text-sm font-medium mb-2">志望動機</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.motivation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
