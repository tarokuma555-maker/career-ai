import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { InterviewQuestion, InterviewResult } from "@/lib/types";

// ---------- レート制限（インメモリ / HMR耐性） ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

const globalForRateLimit = globalThis as unknown as {
  _interviewRateLimitLog?: Map<string, number[]>;
};
const requestLog =
  globalForRateLimit._interviewRateLimitLog ??
  (globalForRateLimit._interviewRateLimitLog = new Map<string, number[]>());

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

// ---------- システムプロンプト: 質問生成 ----------
const GENERATE_SYSTEM_PROMPT = `あなたは経験豊富な日本の面接官・キャリアアドバイザーです。
指定されたキャリアパスに対して、面接で想定される質問を5つ生成してください。

以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{
  "questions": [
    { "id": 1, "question": "質問文" },
    { "id": 2, "question": "質問文" },
    { "id": 3, "question": "質問文" },
    { "id": 4, "question": "質問文" },
    { "id": 5, "question": "質問文" }
  ]
}

ルール：
- 質問は5つちょうど生成する
- 志望動機、自己PR、強み・弱み、キャリアビジョン、具体的な経験を問うものをバランスよく含める
- 候補者の現在のスキルや経験を踏まえた実践的な質問にする
- 日本の転職面接でよく聞かれる形式にする`;

// ---------- システムプロンプト: 回答添削 ----------
const REVIEW_SYSTEM_PROMPT = `あなたは経験豊富な日本の面接コーチです。
候補者の面接回答を添削し、改善案を提示してください。

以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{
  "reviews": [
    {
      "question": "質問文",
      "original_answer": "元の回答",
      "improved_answer": "改善された回答（具体例を交えて、STARメソッドを活用）",
      "score": 70,
      "feedback": "具体的なフィードバック（良い点と改善点を含む）"
    }
  ],
  "overall_score": 65,
  "overall_advice": "全体的なアドバイス（3〜5文）"
}

ルール：
- score は 0〜100 の整数（100が最高評価）
- overall_score は各回答のスコアを総合的に判断した値
- improved_answer は元の回答をベースに大幅に改善したバージョン
- feedback には必ず「良い点」と「改善すべき点」の両方を含める
- overall_advice は全体を通しての改善ポイントを簡潔にまとめる`;

// ---------- JSONパース（フォールバック付き） ----------
function parseJsonResponse<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // コードブロック抽出
  }

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as T;
    } catch {
      // 次のフォールバック
    }
  }

  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1)) as T;
    } catch {
      // パース失敗
    }
  }

  throw new Error("AIの応答をJSONとしてパースできませんでした");
}

// ---------- ルートハンドラー ----------
export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "APIキーが設定されていません。" },
      { status: 500 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "リクエスト回数の上限に達しました。1分後に再度お試しください。" },
      { status: 429 }
    );
  }

  let body: {
    action: "generate" | "review";
    careerPath?: string;
    careerDetail?: string;
    userProfile?: string;
    questions?: { question: string; answer: string }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    if (body.action === "generate") {
      const userMessage = [
        `対象キャリアパス: ${body.careerPath}`,
        "",
        body.careerDetail ? `キャリアパスの詳細:\n${body.careerDetail}` : "",
        "",
        body.userProfile ? `候補者の情報:\n${body.userProfile}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const message = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: GENERATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json(
          { error: "AIからの応答が空でした。" },
          { status: 502 }
        );
      }

      const parsed = parseJsonResponse<{ questions: InterviewQuestion[] }>(
        textBlock.text
      );
      return NextResponse.json(parsed);
    }

    if (body.action === "review") {
      if (!body.questions || body.questions.length === 0) {
        return NextResponse.json(
          { error: "回答データがありません。" },
          { status: 400 }
        );
      }

      const qaPairs = body.questions
        .map(
          (qa, i) =>
            `【質問${i + 1}】${qa.question}\n【回答${i + 1}】${qa.answer}`
        )
        .join("\n\n");

      const userMessage = [
        `対象キャリアパス: ${body.careerPath}`,
        "",
        "以下の質問と回答を添削してください。",
        "",
        qaPairs,
      ].join("\n");

      const message = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: REVIEW_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json(
          { error: "AIからの応答が空でした。" },
          { status: 502 }
        );
      }

      const parsed = parseJsonResponse<InterviewResult>(textBlock.text);
      return NextResponse.json(parsed);
    }

    return NextResponse.json(
      { error: "不正なactionです。" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "APIのレート制限に達しました。しばらく待ってから再度お試しください。" },
          { status: 429 }
        );
      }
      if (error.status === 401) {
        return NextResponse.json(
          { error: "APIキーが無効です。" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `API呼び出しに失敗しました: ${error.message}` },
        { status: error.status ?? 500 }
      );
    }

    if (error instanceof Error && error.message.includes("パース")) {
      return NextResponse.json(
        { error: "AIの応答を処理できませんでした。再度お試しください。" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "予期しないエラーが発生しました。" },
      { status: 500 }
    );
  }
}
