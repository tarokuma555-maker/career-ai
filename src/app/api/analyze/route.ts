import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { DiagnosisData } from "@/lib/diagnosis-schema";
import type { AnalysisResult } from "@/lib/types";

// ---------- レート制限（インメモリ / HMR耐性） ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分
const RATE_LIMIT_MAX = 3;

const globalForRateLimit = globalThis as unknown as {
  _rateLimitLog?: Map<string, number[]>;
};
const requestLog =
  globalForRateLimit._rateLimitLog ??
  (globalForRateLimit._rateLimitLog = new Map<string, number[]>());

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

// ---------- システムプロンプト ----------
const SYSTEM_PROMPT = `あなたは経験豊富な日本のキャリアアドバイザー「キャリアAI」です。
以下の特徴を持ちます：
- 10年以上の人材業界経験を持つプロフェッショナル
- 日本の労働市場に精通している
- 相談者の気持ちに寄り添いながらも、現実的なアドバイスをする
- 特定の企業や求人を推薦せず、中立的な立場を保つ
- 「絶対」「必ず」などの断定的な表現は避ける

★最重要ルール：中学生が読んですぐわかる日本語で書いてください★
- ビジネス用語・カタカナ専門用語は一切使わない
- 1文は30文字以内。短くスパッと書く
- 「たとえば」「つまり」「ざっくり言うと」を使ってかみくだく
- 堅い敬語は使わず「〜だよ」「〜です」のようなやさしい口調にする
- スキル名は中学生が知っている言葉にする（例: ×「マーケティング」→ ○「宣伝のしかた」）
- ロードマップは「具体的に何をすればいいか」を1行で書く
- メリット・デメリットは中学生の生活に例えて書くとベスト

以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{
  "career_paths": [
    {
      "title": "お仕事の名前（短く）",
      "match_score": 85,
      "salary_range": { "min": 400, "max": 600, "unit": "万円" },
      "description": "どんなお仕事か（1〜2文、中学生にわかる言葉で）",
      "why_recommended": "なぜこれがおすすめか（1文で）",
      "roadmap": [
        { "step": 1, "period": "0〜3ヶ月", "action": "やること（中学生でもわかる1行）" }
      ],
      "required_skills": ["スキル1", "スキル2"],
      "pros": ["いいところ（短く）"],
      "cons": ["気をつけること（短く）"],
      "risks": "注意ポイント（1文）"
    }
  ],
  "skill_analysis": {
    "current_skills": { "わかりやすいスキル名": 8 },
    "target_skills": { "わかりやすいスキル名": 5 }
  },
  "overall_advice": "全体のアドバイス（2〜3文、友だちに話すくらいカジュアルに）"
}

ルール：
- career_paths は2〜3個提示する
- match_score は 0〜100 の整数
- salary_range の min/max は万円単位の整数
- roadmap は3〜5ステップ
- current_skills / target_skills のスコアは 1〜10 の整数
- スキルは4〜6個にしぼる
- overall_advice は2〜3文で簡潔にまとめる
- すべてのテキストは中学生が読んですぐわかるレベルにすること`;

// ---------- ユーザーメッセージ生成 ----------
function buildUserMessage(data: DiagnosisData): string {
  const lines = [
    "以下の診断データに基づいてキャリアプランを提案してください。",
    "",
    "【あなたについて】",
    `年齢層: ${data.ageRange}`,
    `就業状況: ${data.employmentStatus}`,
    `職種: ${data.jobType}${data.jobType === "その他" && data.jobTypeOther ? `（${data.jobTypeOther}）` : ""}`,
    "",
    "【これからのこと】",
    `気になること: ${data.concerns.join("、")}`,
    `大事にしたいこと: ${data.values.join("、")}`,
  ];

  return lines.join("\n");
}

// ---------- JSONパース（フォールバック付き） ----------
function parseAnalysisResponse(text: string): AnalysisResult {
  // そのままパースを試行
  try {
    return JSON.parse(text) as AnalysisResult;
  } catch {
    // コードブロックの中にJSONがある場合を抽出
  }

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as AnalysisResult;
    } catch {
      // 次のフォールバックへ
    }
  }

  // 最初の { から最後の } を抽出
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1)) as AnalysisResult;
    } catch {
      // パース失敗
    }
  }

  throw new Error("AIの応答をJSONとしてパースできませんでした");
}

// ---------- ルートハンドラー ----------
export async function POST(request: NextRequest) {
  // APIキーチェック
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "サーバーの設定に問題があります。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  // レート制限チェック
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

  // リクエストボディ取得
  let diagnosisData: DiagnosisData;
  try {
    diagnosisData = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 }
    );
  }

  // Claude API呼び出し
  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserMessage(diagnosisData),
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "AIからの応答が空でした。再度お試しください。" },
        { status: 502 }
      );
    }

    const result = parseAnalysisResponse(textBlock.text);
    return NextResponse.json(result);
  } catch (error) {
    // Anthropic SDK エラー
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "APIのレート制限に達しました。しばらく待ってから再度お試しください。" },
          { status: 429 }
        );
      }
      if (error.status === 401) {
        return NextResponse.json(
          { error: "APIキーが無効です。正しいAPIキーを設定してください。" },
          { status: 401 }
        );
      }
      console.error("Anthropic API error:", error.message);
      return NextResponse.json(
        { error: "API呼び出しに失敗しました。しばらく後にお試しください。" },
        { status: error.status ?? 500 }
      );
    }

    // JSONパースエラー
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
