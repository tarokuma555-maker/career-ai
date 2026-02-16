import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { kv } from "@vercel/kv";
import type { MockInterviewSession, MockInterviewSummary } from "@/lib/mock-interview-types";

// ---------- レート制限 ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

const globalForRateLimit = globalThis as unknown as { _mockSummaryRL?: Map<string, number[]> };
const requestLog = globalForRateLimit._mockSummaryRL ?? (globalForRateLimit._mockSummaryRL = new Map<string, number[]>());

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
const COMPLETED_TTL = 7776000; // 90日

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  first: "一次面接",
  second: "二次面接",
  final: "最終面接",
};

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
    return NextResponse.json({ error: "リクエスト回数の上限に達しました。" }, { status: 429 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "セッションIDが不足しています。" }, { status: 400 });
  }

  const raw = await kv.get<string>(`${KV_PREFIX}${sessionId}`);
  if (!raw) {
    return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
  }
  const session: MockInterviewSession = typeof raw === "string" ? JSON.parse(raw) : raw;

  const interviewTypeLabel = INTERVIEW_TYPE_LABELS[session.settings.interviewType] || session.settings.interviewType;

  const qaList = session.answers.map(a =>
    `Q${a.questionIndex + 1}: ${a.question}\nA: ${a.answer}\nスコア: ${a.evaluation.score}/100\n良い点: ${a.evaluation.goodPoints.join("、")}\n改善点: ${a.evaluation.improvementPoints.join("、")}`
  ).join("\n\n---\n\n");

  const prompt = `以下の模擬面接の結果を総合的に評価してください。

面接設定:
  業界: ${session.settings.industry}
  職種: ${session.settings.position}
  面接タイプ: ${interviewTypeLabel}

各質問の回答と評価:
${qaList}

以下のJSON形式で総合評価を出力してください:
{
  "totalScore": 78,
  "grade": "B+",
  "passLikelihood": "合格の可能性が高い",
  "overallScores": {
    "content": 80,
    "logic": 75,
    "communication": 82,
    "understanding": 70,
    "enthusiasm": 85
  },
  "strengths": [
    "具体的な数字や事例を使った説明力が高い",
    "質問に対してポジティブに回答する姿勢が好印象"
  ],
  "improvements": [
    "質問の意図を正確に把握して、的を射た回答を心がける",
    "結論ファーストで回答する練習をすると、さらに改善できる"
  ],
  "overallFeedback": "全体的に良い回答ができています。特に...",
  "nextSteps": [
    "「転職理由」の回答をもう少しポジティブに練り直す",
    "志望動機に企業研究の要素を追加する",
    "回答の冒頭に結論を持ってくる練習をする"
  ]
}

grade基準:
- S: 90-100
- A+: 85-89
- A: 80-84
- B+: 75-79
- B: 70-74
- C+: 65-69
- C: 60-64
- D: 0-59`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: "AIからの応答が空でした。" }, { status: 502 });
    }

    const summary = parseJsonResponse<MockInterviewSummary>(text);

    session.status = "completed";
    session.summary = summary;
    session.completedAt = new Date().toISOString();

    await kv.set(`${KV_PREFIX}${sessionId}`, JSON.stringify(session), { ex: COMPLETED_TTL });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Mock interview summary error:", error);
    return NextResponse.json({ error: "予期しないエラーが発生しました。" }, { status: 500 });
  }
}

// ---------- GET: セッションデータ取得（共有用） ----------
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "IDが指定されていません。" }, { status: 400 });
  }

  try {
    const raw = await kv.get<string>(`${KV_PREFIX}${id}`);
    if (!raw) {
      return NextResponse.json({ error: "このリンクは期限切れか、存在しません。" }, { status: 404 });
    }
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json(data);
  } catch (err) {
    console.error("KV read error:", err);
    return NextResponse.json({ error: "データの取得に失敗しました。" }, { status: 500 });
  }
}
