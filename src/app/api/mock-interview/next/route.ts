import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { MockInterviewSession } from "@/lib/mock-interview-types";

// ---------- レート制限 ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const globalForRateLimit = globalThis as unknown as { _mockNextRL?: Map<string, number[]> };
const requestLog = globalForRateLimit._mockNextRL ?? (globalForRateLimit._mockNextRL = new Map<string, number[]>());

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

  const { sessionId, currentQuestionIndex } = body;
  if (!sessionId || currentQuestionIndex === undefined) {
    return NextResponse.json({ error: "パラメータが不足しています。" }, { status: 400 });
  }

  const raw = await kv.get<string>(`${KV_PREFIX}${sessionId}`);
  if (!raw) {
    return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
  }
  const session: MockInterviewSession = typeof raw === "string" ? JSON.parse(raw) : raw;

  const nextIndex = currentQuestionIndex + 1;

  // 最後の質問を超えたら完了
  if (nextIndex >= session.questions.length) {
    return NextResponse.json({ isComplete: true });
  }

  const nextPlannedQuestion = session.questions[nextIndex];

  // 前の回答がある場合、深掘り判断
  const lastAnswer = session.answers.find(a => a.questionIndex === currentQuestionIndex);
  if (!lastAnswer) {
    // 回答がない場合はそのまま次の質問
    return NextResponse.json({
      question: nextPlannedQuestion.question,
      transition: "",
      questionIndex: nextIndex,
      isComplete: false,
    });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `前の質問: ${lastAnswer.question}
候補者の回答: ${lastAnswer.answer}
次に予定している質問: ${nextPlannedQuestion.question}

候補者の回答を踏まえて、次の質問を判断してください:
A) 予定通りの質問をする
B) 回答の内容を深掘りする質問に差し替える

Bの場合、面接官の自然な口調で深掘り質問を作成してください。
ただし質問全体の${session.settings.questionCount}問というバランスを考慮してください。

JSONで出力:
{
  "useFollowUp": true or false,
  "question": "深掘りする場合の質問テキスト（Aの場合は予定の質問をそのまま）",
  "transition": "なるほど、○○ということですね。では次に..."
}`,
      }],
    });

    const textBlock = message.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({
        question: nextPlannedQuestion.question,
        transition: "",
        questionIndex: nextIndex,
        isComplete: false,
      });
    }

    const result = parseJsonResponse<{
      useFollowUp: boolean;
      question: string;
      transition: string;
    }>(textBlock.text);

    return NextResponse.json({
      question: result.useFollowUp ? result.question : nextPlannedQuestion.question,
      transition: result.transition || "",
      questionIndex: nextIndex,
      isComplete: false,
    });
  } catch {
    // フォールバック: そのまま次の質問
    return NextResponse.json({
      question: nextPlannedQuestion.question,
      transition: "",
      questionIndex: nextIndex,
      isComplete: false,
    });
  }
}
