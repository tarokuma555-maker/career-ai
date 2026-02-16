import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  TableLayoutType,
  VerticalAlign,
} from "docx";
import { kv } from "@vercel/kv";
import OpenAI from "openai";
import type { StoredDiagnosis } from "@/lib/agent-types";

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
const FULL_WIDTH = 9638;

const borders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

function t(text: string, bold = false, size = SIZE) {
  return new TextRun({ text, bold, size, font: FONT });
}

function p(text: string, opts?: { bold?: boolean; spacing?: { before?: number; after?: number }; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }) {
  return new Paragraph({
    alignment: opts?.alignment,
    spacing: opts?.spacing,
    children: [t(text, opts?.bold)],
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

// ---------- DOCX Generation ----------
function createWorkHistoryTable(work: WorkHistory): Table {
  const rows: TableRow[] = [];

  // Row 1: Period + Company name + Employment type
  rows.push(new TableRow({
    children: [
      new TableCell({
        width: { size: Math.floor(FULL_WIDTH * 0.7), type: WidthType.DXA },
        borders,
        children: [
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [t(`${work.periodFrom}～${work.periodTo}　${work.companyName}`, true)],
          }),
        ],
      }),
      new TableCell({
        width: { size: Math.floor(FULL_WIDTH * 0.3), type: WidthType.DXA },
        borders,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [t(`${work.employmentType}として勤務`)],
          }),
        ],
      }),
    ],
  }));

  // Row 2: Company info
  const companyInfoParagraphs: Paragraph[] = [];
  if (work.businessDescription) {
    companyInfoParagraphs.push(p(`事業内容：${work.businessDescription}`, { spacing: { after: 40 } }));
  }
  if (work.capital || work.revenue) {
    companyInfoParagraphs.push(p(`資本金：${work.capital || "—"}　売上高：${work.revenue || "—"}`, { spacing: { after: 40 } }));
  }
  if (work.employees || work.listing) {
    companyInfoParagraphs.push(p(`従業員数：${work.employees || "—"}　上場：${work.listing || "—"}`, { spacing: { after: 40 } }));
  }
  if (companyInfoParagraphs.length > 0) {
    rows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          width: { size: FULL_WIDTH, type: WidthType.DXA },
          borders,
          children: companyInfoParagraphs,
        }),
      ],
    }));
  }

  // Row 3: Department + Period
  if (work.department) {
    rows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          width: { size: FULL_WIDTH, type: WidthType.DXA },
          borders,
          children: [
            new Paragraph({
              spacing: { before: 60, after: 60 },
              children: [t(`${work.deptPeriodFrom || work.periodFrom}～${work.deptPeriodTo || work.periodTo}　${work.department}`, true)],
            }),
          ],
        }),
      ],
    }));
  }

  // Row 4: Detail sections
  const detailParagraphs: Paragraph[] = [];
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
    detailParagraphs.push(new Paragraph({
      spacing: { before: 80, after: 40 },
      children: [t(`【${label}】`, true)],
    }));
    for (const line of content.split("\n").filter(Boolean)) {
      detailParagraphs.push(new Paragraph({
        spacing: { after: 30 },
        children: [t(line)],
      }));
    }
  }

  if (detailParagraphs.length > 0) {
    rows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          width: { size: FULL_WIDTH, type: WidthType.DXA },
          borders,
          children: detailParagraphs,
        }),
      ],
    }));
  }

  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function createPCSkillsTable(pcSkills: ResumeRequest["pcSkills"]): Table {
  const entries: [string, string][] = [
    ["Word", pcSkills.word],
    ["Excel", pcSkills.excel],
    ["PowerPoint", pcSkills.powerpoint],
  ];
  if (pcSkills.other) entries.push(["その他", pcSkills.other]);

  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: entries.filter(([, v]) => v).map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2400, type: WidthType.DXA },
            borders,
            children: [new Paragraph({ children: [t(label, true)] })],
          }),
          new TableCell({
            width: { size: FULL_WIDTH - 2400, type: WidthType.DXA },
            borders,
            children: [new Paragraph({ children: [t(value)] })],
          }),
        ],
      })
    ),
  });
}

function createQualificationsTable(qualifications: { name: string; date: string }[]): Table {
  return new Table({
    width: { size: FULL_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: qualifications.map(q =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5800, type: WidthType.DXA },
            borders,
            children: [new Paragraph({ children: [t(q.name)] })],
          }),
          new TableCell({
            width: { size: FULL_WIDTH - 5800, type: WidthType.DXA },
            borders,
            children: [new Paragraph({ children: [t(q.date)] })],
          }),
        ],
      })
    ),
  });
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
  const children: (Paragraph | Table)[] = [];

  // (1) Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "職 務 経 歴 書", bold: true, size: 32, font: FONT })],
  }));

  // (2) Date
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 40 },
    children: [t(`${date}現在`)],
  }));

  // (3) Name
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 300 },
    children: [new TextRun({ text: `氏名　${name}`, size: SIZE, font: FONT, underline: { type: "single" } })],
  }));

  // (4) Summary
  if (summaryText) {
    children.push(p("■職務要約", { bold: true, spacing: { before: 200, after: 120 } }));
    for (const line of summaryText.split("\n").filter(Boolean)) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [t(line)],
      }));
    }
  }

  // (5) Work History
  children.push(p("■職務経歴", { bold: true, spacing: { before: 200, after: 120 } }));
  for (let i = 0; i < workHistory.length; i++) {
    children.push(createWorkHistoryTable(workHistory[i]));
    if (i < workHistory.length - 1) {
      children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    }
  }

  // (6) PC Skills
  const hasSkills = pcSkills.word || pcSkills.excel || pcSkills.powerpoint || pcSkills.other;
  if (hasSkills) {
    children.push(p("■PCスキル", { bold: true, spacing: { before: 300, after: 120 } }));
    children.push(createPCSkillsTable(pcSkills));
  }

  // (7) Qualifications
  const validQualifications = qualifications.filter(q => q.name);
  if (validQualifications.length > 0) {
    children.push(p("■資格", { bold: true, spacing: { before: 300, after: 120 } }));
    children.push(createQualificationsTable(validQualifications));
  }

  // (8) Self PR
  if (prData.length > 0) {
    children.push(p("■自己PR", { bold: true, spacing: { before: 300, after: 120 } }));
    for (const pr of prData) {
      children.push(new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [t(`＜${pr.title}＞`, true)],
      }));
      for (const line of pr.content.split("\n").filter(Boolean)) {
        children.push(new Paragraph({
          spacing: { after: 40 },
          children: [t(line)],
        }));
      }
    }
  }

  // (9) End
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 300 },
    children: [t("以上")],
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
  const fileName = `職務経歴書_${name}_${date}.docx`;

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
