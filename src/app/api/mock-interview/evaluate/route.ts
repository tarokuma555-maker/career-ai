import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { MockInterviewSession, AnswerEvaluation } from "@/lib/mock-interview-types";

// ---------- レート制限 ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const globalForRateLimit = globalThis as unknown as { _mockEvalRL?: Map<string, number[]> };
const requestLog = globalForRateLimit._mockEvalRL ?? (globalForRateLimit._mockEvalRL = new Map<string, number[]>());

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
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

  const { sessionId, questionIndex, question, answer, answerDuration } = body;
  if (!sessionId || questionIndex === undefined || !question || !answer) {
    return NextResponse.json({ error: "パラメータが不足しています。" }, { status: 400 });
  }

  // セッション取得
  const raw = await kv.get<string>(`${KV_PREFIX}${sessionId}`);
  if (!raw) {
    return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
  }
  const session: MockInterviewSession = typeof raw === "string" ? JSON.parse(raw) : raw;

  // これまでの質疑応答を構築
  const previousQA = session.answers
    .map(a => `Q: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");

  const interviewTypeLabel = INTERVIEW_TYPE_LABELS[session.settings.interviewType] || session.settings.interviewType;

  const prompt = `あなたは${session.settings.industry}業界の${session.settings.position}職の${interviewTypeLabel}の面接官です。
面接官名: ${session.interviewerProfile.name}（${session.interviewerProfile.role}）

以下の質問に対する候補者の回答を評価してください。

質問: ${question}
候補者の回答: ${answer}
回答時間: ${answerDuration}秒

${previousQA ? `これまでの質疑応答:\n${previousQA}` : ""}

以下のJSON形式で評価してください:
{
  "score": 78,
  "goodPoints": [
    "具体的な数字を使って成果を説明できている",
    "回答の構成が論理的で分かりやすい"
  ],
  "improvementPoints": [
    "行動の動機や背景をもう少し説明すると説得力が増す",
    "結論を先に述べるとさらに良い"
  ],
  "detailScores": {
    "relevance": 80,
    "specificity": 85,
    "logic": 72,
    "enthusiasm": 78
  },
  "shortFeedback": "具体的な数字を使えている点はとても良いです。「なぜその行動を取ったか」の動機をもう少し加えると、さらに説得力が増します。"
}

評価基準:
- 90-100: 素晴らしい回答。実際の面接でも高評価。
- 75-89: 良い回答。いくつかの改善で更に良くなる。
- 60-74: 平均的。改善の余地が大きい。
- 0-59: 要改善。具体性や論理性が不足。

回答時間の目安:
- 30秒未満: 短すぎる（内容が薄い可能性）
- 1-2分: 適切
- 3分以上: 長すぎる（要点がぼやける可能性）`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AIからの応答が空でした。" }, { status: 502 });
    }

    const evaluation = parseJsonResponse<AnswerEvaluation>(textBlock.text);

    // セッション更新
    session.answers.push({
      questionIndex,
      question,
      answer,
      answerDuration: answerDuration || 0,
      evaluation,
      answeredAt: new Date().toISOString(),
    });

    await kv.set(`${KV_PREFIX}${sessionId}`, JSON.stringify(session), { ex: SESSION_TTL });

    return NextResponse.json(evaluation);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "API呼び出しに失敗しました。" }, { status: error.status ?? 500 });
    }
    console.error("Mock interview evaluate error:", error);
    return NextResponse.json({ error: "予期しないエラーが発生しました。" }, { status: 500 });
  }
}
