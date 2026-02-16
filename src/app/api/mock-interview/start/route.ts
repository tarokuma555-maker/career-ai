import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import type { MockInterviewSession, MockQuestion, InterviewerProfile } from "@/lib/mock-interview-types";

export const maxDuration = 60;

// ---------- レート制限 ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

const globalForRateLimit = globalThis as unknown as { _mockStartRL?: Map<string, number[]> };
const requestLog = globalForRateLimit._mockStartRL ?? (globalForRateLimit._mockStartRL = new Map<string, number[]>());

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

const KV_PREFIX = "career-ai:mock-session:";
const SESSION_TTL = 86400;

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  first: "一次面接（人事担当者による基本質問）",
  second: "二次面接（現場マネージャーによる深掘り）",
  final: "最終面接（役員面接、志望度・人柄重視）",
};

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

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "サーバーの設定に問題があります。" }, { status: 500 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "リクエスト回数の上限に達しました。1分後に再度お試しください。" }, { status: 429 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const { settings, resumeData, diagnosisResult } = body;
  if (!settings?.industry || !settings?.position || !settings?.interviewType || !settings?.questionCount) {
    return NextResponse.json({ error: "面接設定が不足しています。" }, { status: 400 });
  }

  const interviewTypeLabel = INTERVIEW_TYPE_LABELS[settings.interviewType] || settings.interviewType;

  const prompt = `あなたは${settings.industry}業界の${settings.position}職の面接官です。
面接タイプ: ${interviewTypeLabel}

以下の候補者の情報を踏まえて、面接質問を${settings.questionCount}問作成してください。

候補者の情報:
- 職歴: ${resumeData?.workHistory ? JSON.stringify(resumeData.workHistory) : "不明"}
- スキル: ${resumeData?.skills ? resumeData.skills.join("、") : "不明"}
- 自己PR: ${resumeData?.selfPR || "不明"}
- キャリア診断結果: ${diagnosisResult ? JSON.stringify(diagnosisResult) : "なし"}

面接タイプ別の特徴:
- 一次面接: 自己紹介、転職理由、志望動機、基本的なスキル確認が中心
- 二次面接: 業務の深掘り、課題解決経験、マネジメント経験、技術的な質問
- 最終面接: 入社意欲、将来ビジョン、企業理解度、人柄・価値観

以下のJSON形式で出力してください:
{
  "interviewerProfile": {
    "name": "面接官の名前（例: 田中）",
    "role": "面接官の役職（例: 人事部 採用マネージャー）"
  },
  "openingMessage": "本日はお忙しい中、面接にお越しいただきありがとうございます。...",
  "questions": [
    {
      "id": 1,
      "question": "まずは自己紹介をお願いいたします。",
      "category": "自己紹介",
      "intent": "候補者の概要把握、コミュニケーション力の確認",
      "followUpHints": ["経歴の深掘り", "転職理由への接続"]
    }
  ]
}`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 16384,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "AIからの応答が空でした。" }, { status: 502 });
    }

    const result = parseJsonResponse<{
      interviewerProfile: InterviewerProfile;
      openingMessage: string;
      questions: MockQuestion[];
    }>(text);

    const sessionId = nanoid(12);
    const now = new Date().toISOString();

    const session: MockInterviewSession = {
      sessionId,
      settings,
      interviewerProfile: result.interviewerProfile,
      openingMessage: result.openingMessage,
      questions: result.questions,
      answers: [],
      status: "in-progress",
      startedAt: now,
    };

    await kv.set(`${KV_PREFIX}${sessionId}`, JSON.stringify(session), { ex: SESSION_TTL });

    return NextResponse.json({
      sessionId,
      interviewerProfile: result.interviewerProfile,
      openingMessage: result.openingMessage,
      firstQuestion: result.questions[0],
    });
  } catch (error) {
    console.error("Mock interview start error:", error);
    return NextResponse.json({ error: "予期しないエラーが発生しました。" }, { status: 500 });
  }
}
