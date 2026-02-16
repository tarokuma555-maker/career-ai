import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { InterviewQuestion, ReviewData, RichInterviewResult } from "@/lib/types";

export const maxDuration = 60;

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

// ---------- システムプロンプト: 回答添削（per-question） ----------
function buildReviewPrompt(
  question: string,
  userAnswer: string,
  careerPath: string
): string {
  return `あなたは面接対策のプロフェッショナルです。
以下の面接質問に対するユーザーの回答を添削してください。

面接質問: ${question}
ユーザーの回答: ${userAnswer}
対象キャリアパス: ${careerPath}

以下のJSON形式で回答してください。JSON以外のテキストは含めないでください。

{
  "score": {
    "total": 72,
    "breakdown": {
      "content": { "score": 80, "label": "内容の充実度" },
      "structure": { "score": 70, "label": "構成・論理性" },
      "specificity": { "score": 60, "label": "具体性" },
      "impression": { "score": 78, "label": "印象・説得力" }
    },
    "grade": "B+",
    "summary": "まずまず良い回答です。具体的な実績を加えるとさらに説得力が増します。"
  },
  "improvedAnswer": "（改善後の回答全文をここに書く）",
  "changes": [
    { "type": "added", "description": "具体的な経験年数・実績を追加" },
    { "type": "improved", "description": "受動的な表現 → 能動的な表現に変更" }
  ],
  "goodPoints": [
    "前向きな転職理由を伝えられている",
    "志望企業への関心を示している"
  ],
  "improvementPoints": [
    {
      "issue": "具体的な数字や実績が不足している",
      "suggestion": "「3年間で○○のシステムを構築し、パフォーマンスを30%改善した」等"
    }
  ],
  "interviewerPerspective": [
    "自社への不満ではなく前向きな理由か",
    "自社で実現したいことが明確か",
    "論理的に説明できるか"
  ]
}

ルール：
- score.total は 0〜100 の整数
- breakdown の各項目も 0〜100
- grade は S/A+/A/B+/B/C+/C/D のいずれか
- improvedAnswer は元の回答をベースに大幅に改善した全文
- changes は最低2つ、最大5つ
- goodPoints は最低1つ
- improvementPoints は最低1つ、各項目に issue と suggestion を含める
- interviewerPerspective は最低2つ`;
}

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
  const apiKey = process.env.OPENAI_API_KEY;
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

  const client = new OpenAI({ apiKey });

  try {
    if (body.action === "generate") {
      if (!body.careerPath || typeof body.careerPath !== "string" || body.careerPath.trim().length === 0) {
        return NextResponse.json(
          { error: "キャリアパスが指定されていません。" },
          { status: 400 }
        );
      }

      const userMessage = [
        `対象キャリアパス: ${body.careerPath}`,
        "",
        body.careerDetail ? `キャリアパスの詳細:\n${body.careerDetail}` : "",
        "",
        body.userProfile ? `候補者の情報:\n${body.userProfile}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const completion = await client.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: GENERATE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        return NextResponse.json(
          { error: "AIからの応答が空でした。" },
          { status: 502 }
        );
      }

      const parsed = parseJsonResponse<{ questions: InterviewQuestion[] }>(text);
      return NextResponse.json(parsed);
    }

    if (body.action === "review") {
      if (!body.questions || body.questions.length === 0) {
        return NextResponse.json(
          { error: "回答データがありません。" },
          { status: 400 }
        );
      }

      const reviewPromises = body.questions.map(async (qa) => {
        const reviewPrompt = buildReviewPrompt(
          qa.question,
          qa.answer,
          body.careerPath ?? ""
        );

        const completion = await client.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 16384,
          messages: [
            { role: "system", content: reviewPrompt },
            { role: "user", content: "この回答を添削してください。" },
          ],
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) {
          throw new Error("AIからの応答が空でした。");
        }

        const reviewData = parseJsonResponse<ReviewData>(text);
        return {
          question: qa.question,
          userAnswer: qa.answer,
          reviewData,
        };
      });

      const reviews = await Promise.all(reviewPromises);
      const result: RichInterviewResult = { reviews };
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "不正なactionです。" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("パース")) {
      return NextResponse.json(
        { error: "AIの応答を処理できませんでした。再度お試しください。" },
        { status: 502 }
      );
    }

    console.error("OpenAI API error:", error);
    return NextResponse.json(
      { error: "API呼び出しに失敗しました。しばらく後にお試しください。" },
      { status: 500 }
    );
  }
}
