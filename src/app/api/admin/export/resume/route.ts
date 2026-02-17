import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from "docx";
import { kv } from "@vercel/kv";
import OpenAI from "openai";
import type { StoredDiagnosis } from "@/lib/agent-types";
import { uploadToGoogleDrive } from "@/lib/google-drive";

export const maxDuration = 60;

// ---------- Types ----------
interface WorkHistory {
  companyName: string;
  periodFrom: string;
  periodTo: string;
  employmentType: string;
  businessDescription: string;
  capital: string;
  revenue: string;
  employees: string;
  listing: string;
  department: string;
  deptPeriodFrom: string;
  deptPeriodTo: string;
  duties: string;
  products: string;
  clients: string;
  salesStyle: string;
  achievements: string;
  projects: string;
}

interface ResumeRequest {
  diagnosisId: string;
  name: string;
  date: string;
  workHistory: WorkHistory[];
  pcSkills: { word: string; excel: string; powerpoint: string; other: string };
  qualifications: { name: string; date: string }[];
  selfPR: { mode: "ai" | "manual"; manualContent?: string };
  summary: { mode: "ai" | "manual"; manualContent?: string };
}

// ---------- Helpers ----------
const FONT = "游ゴシック";
const SIZE = 21;
const SIZE_L = 24;

function tr(text: string, bold = false, size = SIZE) {
  return new TextRun({ text, bold, size, font: FONT });
}

/** セクション見出し（■付き） */
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [tr(text, true, SIZE_L)],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333", space: 4 },
    },
  });
}

/** ラベル: 値 を1行で */
function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      tr(`${label}：`, true),
      tr(value),
    ],
  });
}

/** 通常テキスト行 */
function textLine(text: string, opts?: { bold?: boolean; indent?: number; spacing?: { before?: number; after?: number } }): Paragraph {
  return new Paragraph({
    spacing: opts?.spacing ?? { after: 40 },
    indent: opts?.indent ? { left: opts.indent } : undefined,
    children: [tr(text, opts?.bold)],
  });
}

/** 区切り線 */
function separator(): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 4 },
    },
    children: [],
  });
}

function workHistoryToText(workHistory: WorkHistory[]): string {
  return workHistory.map((w, i) => {
    const lines = [`【${i + 1}社目】 ${w.companyName}`];
    lines.push(`在籍期間: ${w.periodFrom}～${w.periodTo}`);
    lines.push(`雇用形態: ${w.employmentType}`);
    if (w.businessDescription) lines.push(`事業内容: ${w.businessDescription}`);
    if (w.department) lines.push(`配属部署: ${w.department}`);
    if (w.duties) lines.push(`業務内容: ${w.duties}`);
    if (w.products) lines.push(`取扱商品: ${w.products}`);
    if (w.clients) lines.push(`取引顧客: ${w.clients}`);
    if (w.salesStyle) lines.push(`営業スタイル: ${w.salesStyle}`);
    if (w.achievements) lines.push(`主な実績: ${w.achievements}`);
    if (w.projects) lines.push(`主なプロジェクト: ${w.projects}`);
    return lines.join("\n");
  }).join("\n\n");
}

// ---------- AI Generation ----------
async function generateSummary(client: OpenAI, workHistory: WorkHistory[]): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 4096,
    messages: [
      {
        role: "system",
        content: "あなたは転職支援のプロフェッショナルです。職務経歴書の職務要約を作成してください。テキストのみで出力してください（JSON不要）。",
      },
      {
        role: "user",
        content: `以下の職歴情報を元に、職務経歴書の職務要約を3〜5行で作成してください。
簡潔かつ具体的に、キャリアのハイライトと成果を示してください。
「です・ます」調で記述してください。

職歴情報:
${workHistoryToText(workHistory)}

テキストのみで出力してください（JSON不要）。`,
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

async function generateSelfPR(
  client: OpenAI,
  stored: StoredDiagnosis,
  workHistory: WorkHistory[],
): Promise<{ title: string; content: string }[]> {
  const diag = stored.diagnosisData;
  const selfAnalysis = stored.selfAnalysis;
  const detailedPlan = stored.detailedPlan;

  const prompt = `あなたは転職支援のプロフェッショナルです。
以下の求職者の情報を元に、職務経歴書の自己PRを2つ作成してください。

【求職者の診断結果から判明した情報】
氏名: ${diag.name || "不明"}
年齢: ${diag.ageRange || "不明"}
職種: ${diag.jobType || "不明"}

強み: ${(selfAnalysis as Record<string, unknown>)?.strengths || stored.analysisResult.overall_advice || "不明"}
自然に得意: ${(selfAnalysis as Record<string, unknown>)?.naturalStrengths || "不明"}
褒められた経験: ${(selfAnalysis as Record<string, unknown>)?.praisedExperiences || "不明"}

AIアドバイス: ${stored.analysisResult.overall_advice || "なし"}

パーソナリティ: ${detailedPlan?.personalProfile?.summary || "不明"}
コア強み: ${detailedPlan?.personalProfile?.coreStrengths?.join("、") || "不明"}

【職歴情報（手動入力）】
${workHistoryToText(workHistory)}

【作成ルール】
1. 2つの自己PRを作成する
2. 各PRにはタイトルと本文（3〜5行）を含める
3. タイトルは簡潔に（例: 社内外の調整力）
4. 本文には具体的なエピソード、数字、成果を入れる
5. 文体は「です・ます」調で統一する

以下のJSON形式で出力:
{"prs":[{"title":"○○力","content":"説明文..."},{"title":"○○力","content":"説明文..."}]}`;

  const completion = await client.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: "JSONのみ出力してください。" },
      { role: "user", content: prompt },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() || "{}";
  try {
    const parsed = JSON.parse(text.replace(/```json?\s*|\s*```/g, ""));
    return parsed.prs || [];
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return parsed.prs || [];
      } catch {
        return [{ title: "自己PR", content: text }];
      }
    }
    return [{ title: "自己PR", content: text }];
  }
}

// ---------- DOCX Generation (テキストベース、表なし) ----------
function buildWorkHistoryParagraphs(work: WorkHistory): Paragraph[] {
  const out: Paragraph[] = [];

  // ヘッダー行: 期間 + 会社名 + 雇用形態
  out.push(new Paragraph({
    spacing: { before: 100, after: 60 },
    children: [
      tr(`${work.periodFrom}～${work.periodTo}　`, true),
      tr(work.companyName, true),
      tr(`　（${work.employmentType}）`),
    ],
  }));

  // 会社情報
  if (work.businessDescription) out.push(labelValue("事業内容", work.businessDescription));
  if (work.capital || work.revenue) {
    const parts: string[] = [];
    if (work.capital) parts.push(`資本金 ${work.capital}`);
    if (work.revenue) parts.push(`売上高 ${work.revenue}`);
    out.push(textLine(parts.join("　／　"), { indent: 200 }));
  }
  if (work.employees || work.listing) {
    const parts: string[] = [];
    if (work.employees) parts.push(`従業員数 ${work.employees}`);
    if (work.listing) parts.push(`上場 ${work.listing}`);
    out.push(textLine(parts.join("　／　"), { indent: 200 }));
  }

  // 配属部署
  if (work.department) {
    out.push(new Paragraph({
      spacing: { before: 80, after: 40 },
      children: [
        tr(`${work.deptPeriodFrom || work.periodFrom}～${work.deptPeriodTo || work.periodTo}　`, true),
        tr(work.department, true),
      ],
    }));
  }

  // 業務詳細セクション
  const sections: [string, string][] = [
    ["業務内容", work.duties],
    ["取扱商品", work.products],
    ["取引顧客", work.clients],
    ["営業スタイル", work.salesStyle],
    ["主な実績", work.achievements],
    ["主なプロジェクト", work.projects],
  ];

  for (const [label, content] of sections) {
    if (!content) continue;
    out.push(textLine(`【${label}】`, { bold: true, spacing: { before: 80, after: 30 } }));
    for (const line of content.split("\n").filter(Boolean)) {
      out.push(textLine(line, { indent: 200 }));
    }
  }

  return out;
}

// ---------- Route Handler ----------
export async function POST(request: NextRequest) {
  let body: ResumeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const { diagnosisId, name, date, workHistory, pcSkills, qualifications, selfPR, summary } = body;

  if (!diagnosisId || !name) {
    return NextResponse.json({ error: "必須項目が不足しています。" }, { status: 400 });
  }

  // Fetch stored diagnosis
  let stored: StoredDiagnosis | null = null;
  try {
    const raw = await kv.get<string>(`career-ai:diagnosis:${diagnosisId}`);
    if (raw) {
      stored = typeof raw === "string" ? JSON.parse(raw) : raw;
    }
  } catch (err) {
    console.error("KV read error:", err);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const client = apiKey ? new OpenAI({ apiKey }) : null;

  // Generate summary
  let summaryText = "";
  if (summary.mode === "manual" && summary.manualContent) {
    summaryText = summary.manualContent;
  } else if (summary.mode === "ai" && client) {
    try {
      summaryText = await generateSummary(client, workHistory);
    } catch (err) {
      console.error("Summary generation error:", err);
      summaryText = "（職務要約の自動生成に失敗しました）";
    }
  }

  // Generate self PR
  let prData: { title: string; content: string }[] = [];
  if (selfPR.mode === "manual" && selfPR.manualContent) {
    prData = [{ title: "自己PR", content: selfPR.manualContent }];
  } else if (selfPR.mode === "ai" && client && stored) {
    try {
      prData = await generateSelfPR(client, stored, workHistory);
    } catch (err) {
      console.error("Self PR generation error:", err);
      prData = [{ title: "自己PR", content: "（自己PRの自動生成に失敗しました）" }];
    }
  }

  // Build document children
  const children: Paragraph[] = [];

  // (1) タイトル
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "職 務 経 歴 書", bold: true, size: 32, font: FONT })],
  }));

  // (2) 日付
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 40 },
    children: [tr(`${date}現在`)],
  }));

  // (3) 氏名
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 300 },
    children: [new TextRun({ text: `氏名　${name}`, size: SIZE, font: FONT, underline: { type: "single" } })],
  }));

  // (4) 職務要約
  if (summaryText) {
    children.push(sectionHeading("■職務要約"));
    for (const line of summaryText.split("\n").filter(Boolean)) {
      children.push(textLine(line));
    }
  }

  // (5) 職務経歴
  children.push(sectionHeading("■職務経歴"));
  for (let i = 0; i < workHistory.length; i++) {
    children.push(...buildWorkHistoryParagraphs(workHistory[i]));
    if (i < workHistory.length - 1) {
      children.push(separator());
    }
  }

  // (6) PCスキル
  const hasSkills = pcSkills.word || pcSkills.excel || pcSkills.powerpoint || pcSkills.other;
  if (hasSkills) {
    children.push(sectionHeading("■PCスキル"));
    if (pcSkills.word) children.push(labelValue("Word", pcSkills.word));
    if (pcSkills.excel) children.push(labelValue("Excel", pcSkills.excel));
    if (pcSkills.powerpoint) children.push(labelValue("PowerPoint", pcSkills.powerpoint));
    if (pcSkills.other) children.push(labelValue("その他", pcSkills.other));
  }

  // (7) 資格
  const validQualifications = qualifications.filter(q => q.name);
  if (validQualifications.length > 0) {
    children.push(sectionHeading("■資格"));
    for (const q of validQualifications) {
      children.push(new Paragraph({
        spacing: { after: 40 },
        children: [
          tr(q.name),
          tr(q.date ? `　（${q.date}）` : ""),
        ],
      }));
    }
  }

  // (8) 自己PR
  if (prData.length > 0) {
    children.push(sectionHeading("■自己PR"));
    for (const pr of prData) {
      children.push(new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [tr(`＜${pr.title}＞`, true)],
      }));
      for (const line of pr.content.split("\n").filter(Boolean)) {
        children.push(textLine(line));
      }
    }
  }

  // (9) 以上
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 300 },
    children: [tr("以上")],
  }));

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const uint8 = new Uint8Array(buffer);
  const displayName = `職務経歴書_${name}_${date}`;
  const fileName = `${displayName}.docx`;

  // Google Drive にアップロードを試みる
  try {
    const fileId = await uploadToGoogleDrive(
      uint8,
      displayName,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.google-apps.document",
    );
    return NextResponse.json({
      url: `https://docs.google.com/document/d/${fileId}/edit`,
      type: "google_docs",
    });
  } catch (err) {
    console.warn("Google Drive upload skipped:", err instanceof Error ? err.message : err);
  }

  // フォールバック: .docx バイナリを返す
  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
