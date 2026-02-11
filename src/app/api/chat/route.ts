import { NextRequest } from "next/server";
import OpenAI from "openai";

// ---------- レート制限（インメモリ / HMR耐性） ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const globalForRateLimit = globalThis as unknown as {
  _chatRateLimitLog?: Map<string, number[]>;
};
const requestLog =
  globalForRateLimit._chatRateLimitLog ??
  (globalForRateLimit._chatRateLimitLog = new Map<string, number[]>());

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  requestLog.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) {
    return true;
  }
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  diagnosisData?: Record<string, unknown>;
  analysisResult?: Record<string, unknown>;
}

function buildSystemPrompt(
  diagnosisData?: Record<string, unknown>,
  analysisResult?: Record<string, unknown>
): string {
  let prompt = `あなたは経験豊富な日本のキャリアアドバイザー「キャリアAI」です。
以下の特徴を持ちます：
- 10年以上の人材業界経験を持つプロフェッショナル
- 日本の労働市場に精通している
- 相談者の気持ちに寄り添いながらも、現実的なアドバイスをする
- 特定の企業や求人を推薦せず、中立的な立場を保つ
- 「絶対」「必ず」などの断定的な表現は避ける
- 回答はMarkdown形式で読みやすく整理する
- 回答は簡潔に、長くても500文字程度にまとめる`;

  if (diagnosisData) {
    prompt += `\n\n【ユーザーの診断データ】\n${JSON.stringify(diagnosisData, null, 2)}`;
  }

  if (analysisResult) {
    prompt += `\n\n【AIが提案したキャリアプラン】\n${JSON.stringify(analysisResult, null, 2)}`;
  }

  if (diagnosisData || analysisResult) {
    prompt +=
      "\n\n上記の診断データとキャリアプランの内容を踏まえて、ユーザーの質問に答えてください。";
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "APIキーが設定されていません。" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({
        error: "リクエスト回数の上限に達しました。1分後に再度お試しください。",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "リクエストの形式が正しくありません。" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, diagnosisData, analysisResult } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "メッセージが空です。" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const validRoles = new Set(["user", "assistant"]);
  const validatedMessages = messages.filter(
    (m): m is ChatMessage =>
      m &&
      typeof m === "object" &&
      typeof m.content === "string" &&
      validRoles.has(m.role)
  );
  if (validatedMessages.length === 0) {
    return new Response(
      JSON.stringify({ error: "有効なメッセージがありません。" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const totalLength = validatedMessages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalLength > 50000) {
    return new Response(
      JSON.stringify({ error: "メッセージが長すぎます。" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = buildSystemPrompt(diagnosisData, analysisResult);

  try {
    const client = new OpenAI({ apiKey });

    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...validatedMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              const data = JSON.stringify({ text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("OpenAI stream error:", err);
          const errData = JSON.stringify({ error: "API呼び出しに失敗しました。しばらく後にお試しください。" });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return new Response(
      JSON.stringify({ error: "API呼び出しに失敗しました。しばらく後にお試しください。" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
