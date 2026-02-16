import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { kv } from "@vercel/kv";
import type { ResumeFormData, DocumentType, GeneratedResumeData, GeneratedCVData, ResumeStoredData } from "@/lib/resume-types";

// ---------- レート制限 ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

const globalForRateLimit = globalThis as unknown as { _resumeGenRL?: Map<string, number[]> };
const requestLog = globalForRateLimit._resumeGenRL ?? (globalForRateLimit._resumeGenRL = new Map<string, number[]>());

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  requestLog.set(ip, recent);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

function getIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

// ---------- JSON Parse Helper ----------
function parseJsonResponse<T>(text: string): T {
  try { return JSON.parse(text); } catch { /* fallback */ }
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) { try { return JSON.parse(match[1]); } catch { /* next */ } }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fail */ } }
  throw new Error("AIの応答をパースできませんでした");
}

// ---------- 自己PR/志望動機 生成 ----------
async function handleGeneratePR(
  formData: ResumeFormData,
  field: "selfPR" | "motivation",
  diagnosisData: Record<string, unknown> | null,
  apiKey: string
): Promise<NextResponse> {
  const prompt = field === "selfPR"
    ? `あなたは転職のプロフェッショナルです。
以下の情報をもとに、採用担当者に響く自己PR文を200〜400字程度で生成してください。
具体的なエピソードや数値を盛り込み、日本のビジネス文書にふさわしい表現にしてください。

【職歴】
${formData.workHistory.map(w => `${w.company}（${w.startYear}${w.startMonth}〜${w.isCurrent ? "現在" : `${w.endYear}${w.endMonth}`}）${w.position || ""}\n業務内容: ${w.duties}`).join("\n\n")}

【スキル】${formData.skills.join("、")}
${diagnosisData ? `\n【キャリア診断結果】職種: ${diagnosisData.jobType || ""} / 業界: ${diagnosisData.industry || ""}` : ""}

JSON形式で出力: { "selfPR": "生成した自己PR文" }`
    : `あなたは転職のプロフェッショナルです。
以下の情報をもとに、説得力のある志望動機を200〜300字程度で生成してください。

【職歴】
${formData.workHistory.map(w => `${w.company}（${w.position || ""}）: ${w.duties}`).join("\n")}

【スキル】${formData.skills.join("、")}
${formData.basicInfo.preferences.industry ? `【希望業界】${formData.basicInfo.preferences.industry}` : ""}
${formData.basicInfo.preferences.position ? `【希望職種】${formData.basicInfo.preferences.position}` : ""}

JSON形式で出力: { "motivation": "生成した志望動機文" }`;

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    return NextResponse.json({ error: "AIからの応答が空でした。" }, { status: 502 });
  }

  const parsed = parseJsonResponse<Record<string, string>>(text);
  return NextResponse.json(parsed);
}

// ---------- 履歴書生成 ----------
const RESUME_SYSTEM_PROMPT = `あなたは転職のプロフェッショナルです。
以下の情報をもとに、JIS規格に準拠した履歴書の内容を作成してください。

以下のJSON形式のみで出力してください:
{
  "personalInfo": {
    "name": "氏名",
    "nameKana": "フリガナ",
    "birthdate": "YYYY年M月D日",
    "age": 数値,
    "gender": "性別",
    "address": "住所",
    "phone": "電話番号",
    "email": "メール"
  },
  "education": [
    { "yearMonth": "YYYY年M月", "detail": "学校名 入学/卒業" }
  ],
  "workHistory": [
    { "yearMonth": "YYYY年M月", "detail": "会社名 入社/退職\\n部署に配属" }
  ],
  "qualifications": [
    { "yearMonth": "YYYY年M月", "detail": "資格名 取得" }
  ],
  "selfPR": "自己PR文"
}

ルール:
- 学歴は入学と卒業(中退)を別行にする
- 職歴は入社、配属、退職を適切に分ける
- 最後の職歴が在職中なら "現在に至る" を追加
- 自己PRはユーザー入力を丁寧に整える`;

// ---------- 職務経歴書生成 ----------
const CV_SYSTEM_PROMPT = `あなたは転職のプロフェッショナルです。
以下の情報をもとに、説得力のある職務経歴書の内容を作成してください。
ユーザーが入力した業務内容を、採用担当者に響く表現にブラッシュアップしてください。

以下のJSON形式のみで出力してください:
{
  "summary": "職務要約（3〜4行で経歴を要約）",
  "workHistory": [
    {
      "company": "会社名",
      "period": "YYYY年M月〜YYYY年M月（X年）",
      "department": "部署",
      "position": "役職",
      "employmentType": "雇用形態",
      "companyDescription": "事業内容の簡潔な説明",
      "responsibilities": "業務内容の詳細",
      "achievements": ["実績1", "実績2"]
    }
  ],
  "skills": {
    "technical": ["スキル1"],
    "business": ["スキル2"],
    "languages": ["語学"]
  },
  "qualifications": ["資格名（取得年）"],
  "selfPR": "ブラッシュアップした自己PR文",
  "motivation": "志望動機（あれば）"
}

ルール:
- 業務内容は具体的な数値や成果を含めてブラッシュアップ
- 実績は箇条書きで2〜5個
- スキルはtechnical/business/languagesに分類`;

async function handleGenerateDocument(
  type: DocumentType,
  formData: ResumeFormData,
  diagnosisData: Record<string, unknown> | null,
  _analysisResult: Record<string, unknown> | null,
  apiKey: string,
  ip: string
): Promise<NextResponse> {
  const client = new OpenAI({ apiKey });

  const userInfo = [
    `基本情報: ${formData.basicInfo.lastName} ${formData.basicInfo.firstName}`,
    `学歴:\n${formData.education.filter(e => e.school).map(e => `  ${e.startYear}${e.startMonth} ${e.school}${e.faculty ? ` ${e.faculty}` : ""} (${e.status})`).join("\n")}`,
    formData.noWorkHistory ? "職歴: なし" :
      `職歴:\n${formData.workHistory.filter(w => w.company).map(w =>
        `  ${w.company}（${w.startYear}${w.startMonth}〜${w.isCurrent ? "現在" : `${w.endYear}${w.endMonth}`}）\n  部署: ${w.department || "なし"} / 役職: ${w.position || "なし"} / ${w.employmentType}\n  業務内容: ${w.duties}`
      ).join("\n\n")}`,
    `資格: ${formData.qualifications.filter(q => q.name).map(q => `${q.name}（${q.year}${q.month}）`).join("、") || "なし"}`,
    `スキル: ${formData.skills.join("、") || "なし"}`,
    `語学: ${formData.languages.filter(l => l.language).map(l => `${l.language}（${l.level}）`).join("、") || "なし"}`,
    `自己PR: ${formData.selfPR}`,
    formData.motivation ? `志望動機: ${formData.motivation}` : "",
    diagnosisData ? `キャリア診断データ: 職種=${diagnosisData.jobType || ""}, 業界=${diagnosisData.industry || ""}` : "",
  ].filter(Boolean).join("\n\n");

  let generatedResume: GeneratedResumeData | undefined;
  let generatedCV: GeneratedCVData | undefined;

  if (type === "resume" || type === "both") {
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: RESUME_SYSTEM_PROMPT },
        { role: "user", content: userInfo },
      ],
    });
    const text = completion.choices[0]?.message?.content;
    if (text) {
      generatedResume = parseJsonResponse<GeneratedResumeData>(text);
    }
  }

  if (type === "cv" || type === "both") {
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: CV_SYSTEM_PROMPT },
        { role: "user", content: userInfo },
      ],
    });
    const text = completion.choices[0]?.message?.content;
    if (text) {
      generatedCV = parseJsonResponse<GeneratedCVData>(text);
    }
  }

  const now = new Date().toISOString();
  const storedData: ResumeStoredData = {
    type,
    formData,
    generatedResume,
    generatedCV,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await kv.set(`career-ai:resume:${ip}`, JSON.stringify(storedData), { ex: 7776000 });
  } catch (err) {
    console.error("KV write error:", err);
  }

  return NextResponse.json({
    type,
    generatedResume,
    generatedCV,
    formData,
  });
}

// ---------- Route Handler ----------
export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "サーバーの設定に問題があります。" }, { status: 500 });
  }

  const ip = getIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "リクエスト回数の上限に達しました。1分後に再度お試しください。" }, { status: 429 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  try {
    if (body.action === "generate-pr") {
      return await handleGeneratePR(body.formData, body.field || "selfPR", body.diagnosisData || null, apiKey);
    }
    if (body.action === "generate-document") {
      return await handleGenerateDocument(body.type || "both", body.formData, body.diagnosisData || null, body.analysisResult || null, apiKey, ip);
    }
    return NextResponse.json({ error: "不明なアクションです。" }, { status: 400 });
  } catch (error) {
    console.error("Resume generate error:", error);
    return NextResponse.json({ error: "予期しないエラーが発生しました。" }, { status: 500 });
  }
}
