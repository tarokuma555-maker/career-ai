"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Loader2,
  Pencil,
  Check,
  FileText,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageTransition from "@/components/PageTransition";
import LineShareButton from "@/components/LineShareButton";
import type { DocumentType, ResumeFormData, GeneratedResumeData, GeneratedCVData } from "@/lib/resume-types";
import type { ShareUrls } from "@/lib/lineShare";

const STORAGE_KEY = "career-ai-resume-result";

interface ResumeResult {
  type: DocumentType;
  generatedResume?: GeneratedResumeData;
  generatedCV?: GeneratedCVData;
  formData: ResumeFormData;
}

export default function ResumePreviewPage() {
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [isDownloading, setIsDownloading] = useState<"resume" | "cv" | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setResult(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveResult = useCallback((updated: ResumeResult) => {
    setResult(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const startEdit = (section: string, value: string) => {
    setEditingSection(section);
    setEditValue(value);
  };

  const saveEdit = () => {
    if (!result || !editingSection) return;
    const updated = { ...result };

    // Resume edits
    if (editingSection === "resume-selfPR" && updated.generatedResume) {
      updated.generatedResume = { ...updated.generatedResume, selfPR: editValue };
    }
    // CV edits
    else if (editingSection === "cv-summary" && updated.generatedCV) {
      updated.generatedCV = { ...updated.generatedCV, summary: editValue };
    } else if (editingSection === "cv-selfPR" && updated.generatedCV) {
      updated.generatedCV = { ...updated.generatedCV, selfPR: editValue };
    } else if (editingSection === "cv-motivation" && updated.generatedCV) {
      updated.generatedCV = { ...updated.generatedCV, motivation: editValue };
    } else if (editingSection.startsWith("cv-resp-") && updated.generatedCV) {
      const idx = parseInt(editingSection.replace("cv-resp-", ""));
      updated.generatedCV = {
        ...updated.generatedCV,
        workHistory: updated.generatedCV.workHistory.map((w, i) =>
          i === idx ? { ...w, responsibilities: editValue } : w
        ),
      };
    }

    saveResult(updated);
    setEditingSection(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditValue("");
  };

  const handleDownload = async (docType: "resume" | "cv") => {
    if (!result) return;
    setIsDownloading(docType);
    try {
      const res = await fetch("/api/resume/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          generatedResume: docType === "resume" ? result.generatedResume : undefined,
          generatedCV: docType === "cv" ? result.generatedCV : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "ダウンロードに失敗しました");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      a.download = `${docType === "resume" ? "履歴書" : "職務経歴書"}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "ダウンロードに失敗しました");
    } finally {
      setIsDownloading(null);
    }
  };

  const handleShareToAgent = useCallback(async (): Promise<ShareUrls> => {
    if (!result) return {};
    setIsSharing(true);
    try {
      const basicInfo = result.formData.basicInfo;
      const diagnosisShareId = (() => {
        try { return localStorage.getItem("career-ai-share-id") || undefined; } catch { return undefined; }
      })();
      const interviewShareId = (() => {
        try { return localStorage.getItem("career-ai-interview-share-id") || undefined; } catch { return undefined; }
      })();

      const existingProfileShareId = (() => {
        try { return localStorage.getItem("career-ai-profile-share-id") || undefined; } catch { return undefined; }
      })();

      const res = await fetch("/api/profile/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareId: existingProfileShareId,
          basicInfo,
          resumeData: {
            education: result.formData.education,
            workHistory: result.formData.workHistory,
            noWorkHistory: result.formData.noWorkHistory,
            qualifications: result.formData.qualifications,
            skills: result.formData.skills,
            languages: result.formData.languages,
            selfPR: result.formData.selfPR,
            motivation: result.formData.motivation,
          },
          generatedResume: result.generatedResume,
          generatedCV: result.generatedCV,
          diagnosisShareId,
          interviewShareId,
        }),
      });

      if (!res.ok) throw new Error("共有データの作成に失敗しました");
      const data = await res.json();
      localStorage.setItem("career-ai-profile-share-id", data.shareId);

      return { resultShareUrl: data.shareUrl };
    } finally {
      setIsSharing(false);
    }
  }, [result]);

  // Editable text section helper
  const EditableText = ({
    sectionKey,
    value,
    rows = 4,
  }: {
    sectionKey: string;
    value: string;
    rows?: number;
  }) => {
    if (editingSection === sectionKey) {
      return (
        <div className="space-y-2">
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={rows}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} className="gap-1">
              <Check className="w-3.5 h-3.5" />
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              キャンセル
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="group relative">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{value || "（未入力）"}</p>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => startEdit(sectionKey, value)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    );
  };

  // Skeleton loading
  if (!result) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen py-10 px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-2 animate-pulse">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-8 w-48 bg-muted rounded" />
            </div>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-5 w-32 bg-muted rounded" /></CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-4 w-1/2 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </PageTransition>
    );
  }

  const hasResume = !!result.generatedResume;
  const hasCV = !!result.generatedCV;
  const defaultTab = hasResume ? "resume" : "cv";

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <Link
              href="/resume/create"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              フォームに戻る
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              書類プレビュー
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              テキスト部分はホバーして編集できます
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <LineShareButton
                context="resume"
                onShare={handleShareToAgent}
                label="エージェントに共有する"
                disabled={isSharing}
              />
            </div>
          </div>

          {/* Tabs for resume/CV */}
          {hasResume && hasCV ? (
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="resume" className="gap-1.5">
                  <FileText className="w-4 h-4" />
                  履歴書
                </TabsTrigger>
                <TabsTrigger value="cv" className="gap-1.5">
                  <ScrollText className="w-4 h-4" />
                  職務経歴書
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resume" className="mt-4 space-y-4">
                <ResumePreview
                  data={result.generatedResume!}
                  EditableText={EditableText}
                />
                <DownloadButton
                  docType="resume"
                  label="履歴書をPDFダウンロード"
                  isDownloading={isDownloading}
                  onDownload={handleDownload}
                />
              </TabsContent>

              <TabsContent value="cv" className="mt-4 space-y-4">
                <CVPreview
                  data={result.generatedCV!}
                  EditableText={EditableText}
                />
                <DownloadButton
                  docType="cv"
                  label="職務経歴書をPDFダウンロード"
                  isDownloading={isDownloading}
                  onDownload={handleDownload}
                />
              </TabsContent>
            </Tabs>
          ) : hasResume ? (
            <div className="space-y-4">
              <ResumePreview data={result.generatedResume!} EditableText={EditableText} />
              <DownloadButton
                docType="resume"
                label="履歴書をPDFダウンロード"
                isDownloading={isDownloading}
                onDownload={handleDownload}
              />
            </div>
          ) : hasCV ? (
            <div className="space-y-4">
              <CVPreview data={result.generatedCV!} EditableText={EditableText} />
              <DownloadButton
                docType="cv"
                label="職務経歴書をPDFダウンロード"
                isDownloading={isDownloading}
                onDownload={handleDownload}
              />
            </div>
          ) : null}

          {/* Bottom actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/resume/create">フォームに戻る</Link>
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/result">診断結果に戻る</Link>
            </Button>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}

// ---------- Resume Preview (A4-style) ----------
function ResumePreview({
  data,
  EditableText,
}: {
  data: GeneratedResumeData;
  EditableText: React.ComponentType<{ sectionKey: string; value: string; rows?: number }>;
}) {
  return (
    <div className="bg-white dark:bg-gray-950 border rounded-lg shadow-sm p-6 sm:p-8 space-y-5"
         style={{ maxWidth: "210mm", margin: "0 auto" }}>
      {/* Title */}
      <div className="text-center border-b-2 border-primary pb-4">
        <h2 className="text-xl font-bold tracking-widest">履 歴 書</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日 現在
        </p>
      </div>

      {/* Personal Info */}
      <div>
        <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">基本情報</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground text-xs w-16 inline-block">氏名</span> {data.personalInfo.name}（{data.personalInfo.nameKana}）</div>
          <div><span className="text-muted-foreground text-xs w-16 inline-block">生年月日</span> {data.personalInfo.birthdate}（{data.personalInfo.age}歳）</div>
          {data.personalInfo.gender && <div><span className="text-muted-foreground text-xs w-16 inline-block">性別</span> {data.personalInfo.gender}</div>}
          <div><span className="text-muted-foreground text-xs w-16 inline-block">住所</span> {data.personalInfo.address}</div>
          <div><span className="text-muted-foreground text-xs w-16 inline-block">電話</span> {data.personalInfo.phone}</div>
          <div><span className="text-muted-foreground text-xs w-16 inline-block">メール</span> {data.personalInfo.email}</div>
        </div>
      </div>

      {/* Education */}
      <div>
        <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">学歴</h3>
        <div className="space-y-1">
          {data.education.map((e, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="text-muted-foreground w-20 flex-shrink-0 text-xs">{e.yearMonth}</span>
              <span className="text-xs">{e.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Work History */}
      <div>
        <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">職歴</h3>
        <div className="space-y-1">
          {data.workHistory.map((w, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="text-muted-foreground w-20 flex-shrink-0 text-xs">{w.yearMonth}</span>
              <span className="text-xs whitespace-pre-wrap">{w.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Qualifications */}
      {data.qualifications.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">資格・免許</h3>
          <div className="space-y-1">
            {data.qualifications.map((q, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-muted-foreground w-20 flex-shrink-0 text-xs">{q.yearMonth}</span>
                <span className="text-xs">{q.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Self PR */}
      <div>
        <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">自己PR</h3>
        <EditableText sectionKey="resume-selfPR" value={data.selfPR} rows={6} />
      </div>

      <p className="text-center text-[10px] text-muted-foreground border-t pt-3">Career Planning で自動生成されました</p>
    </div>
  );
}

// ---------- CV Preview (A4-style) ----------
function CVPreview({
  data,
  EditableText,
}: {
  data: GeneratedCVData;
  EditableText: React.ComponentType<{ sectionKey: string; value: string; rows?: number }>;
}) {
  return (
    <div className="bg-white dark:bg-gray-950 border rounded-lg shadow-sm p-6 sm:p-8 space-y-5"
         style={{ maxWidth: "210mm", margin: "0 auto" }}>
      {/* Title */}
      <div className="text-center border-b-2 border-primary pb-4">
        <h2 className="text-xl font-bold tracking-widest">職 務 経 歴 書</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日 現在
        </p>
      </div>

      {/* Summary */}
      {data.summary && (
        <div>
          <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">職務要約</h3>
          <EditableText sectionKey="cv-summary" value={data.summary} rows={4} />
        </div>
      )}

      {/* Work History */}
      <div>
        <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">職務経歴</h3>
        <div className="space-y-5">
          {data.workHistory.map((w, i) => (
            <div key={i} className="border-l-2 border-primary/30 pl-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm font-bold">{w.company}</p>
                <span className="text-xs text-muted-foreground flex-shrink-0">{w.period}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {w.department}{w.position ? ` / ${w.position}` : ""} ({w.employmentType})
              </p>
              {w.companyDescription && (
                <p className="text-xs text-muted-foreground mb-2">事業内容: {w.companyDescription}</p>
              )}
              <div className="mb-2">
                <EditableText sectionKey={`cv-resp-${i}`} value={w.responsibilities} rows={3} />
              </div>
              {w.achievements.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-primary mb-1">実績・成果</p>
                  <ul className="space-y-0.5">
                    {w.achievements.map((a, j) => (
                      <li key={j} className="text-xs text-muted-foreground">・{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">スキル</h3>
        {data.skills.technical.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium mb-1">技術スキル</p>
            <div className="flex flex-wrap gap-1">
              {data.skills.technical.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
            </div>
          </div>
        )}
        {data.skills.business.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium mb-1">ビジネススキル</p>
            <div className="flex flex-wrap gap-1">
              {data.skills.business.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
            </div>
          </div>
        )}
        {data.skills.languages.length > 0 && (
          <p className="text-xs"><span className="font-medium">語学:</span> {data.skills.languages.join("、")}</p>
        )}
      </div>

      {/* Qualifications */}
      {data.qualifications.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">資格</h3>
          <ul className="space-y-0.5">
            {data.qualifications.map((q, i) => (
              <li key={i} className="text-xs text-muted-foreground">・{q}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Self PR */}
      <div>
        <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">自己PR</h3>
        <EditableText sectionKey="cv-selfPR" value={data.selfPR} rows={6} />
      </div>

      {/* Motivation */}
      {data.motivation && (
        <div>
          <h3 className="text-sm font-bold text-primary border-b pb-1 mb-3">志望動機</h3>
          <EditableText sectionKey="cv-motivation" value={data.motivation} rows={4} />
        </div>
      )}

      <p className="text-right text-xs mt-4">以上</p>
      <p className="text-center text-[10px] text-muted-foreground border-t pt-3">Career Planning で自動生成されました</p>
    </div>
  );
}

// ---------- Download Button ----------
function DownloadButton({
  docType,
  label,
  isDownloading,
  onDownload,
}: {
  docType: "resume" | "cv";
  label: string;
  isDownloading: "resume" | "cv" | null;
  onDownload: (docType: "resume" | "cv") => void;
}) {
  const loading = isDownloading === docType;
  return (
    <Button
      className="w-full gap-2"
      onClick={() => onDownload(docType)}
      disabled={isDownloading !== null}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {label}
    </Button>
  );
}
