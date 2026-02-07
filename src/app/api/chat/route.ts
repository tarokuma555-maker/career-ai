import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "APIキーが設定されていません。.env.local にANTHROPIC_API_KEYを設定してください。",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
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

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(diagnosisData, analysisResult);

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message =
            err instanceof Anthropic.APIError
              ? `API呼び出しに失敗しました: ${err.message}`
              : "予期しないエラーが発生しました。";
          const errData = JSON.stringify({ error: message });
          controller.enqueue(
            encoder.encode(`data: ${errData}\n\n`)
          );
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
    if (error instanceof Anthropic.APIError) {
      const status = error.status ?? 500;
      const msg =
        status === 429
          ? "APIのレート制限に達しました。しばらく待ってから再度お試しください。"
          : status === 401
            ? "APIキーが無効です。正しいAPIキーを設定してください。"
            : `API呼び出しに失敗しました: ${error.message}`;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: "予期しないエラーが発生しました。" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
