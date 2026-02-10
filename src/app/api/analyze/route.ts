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

★最重要ルール：高校生でもすぐ理解できるやさしい日本語で書いてください★
- 難しいビジネス用語や専門用語は使わない。使う場合は必ず「〇〇（＝かんたんな説明）」のように補足する
- 一文は短く、40文字以内を目安にする
- 「つまり」「たとえば」「ざっくり言うと」など、かみくだいた表現を積極的に使う
- 堅い敬語よりも「〜です」「〜ですね」のようなやさしい口調にする
- ロードマップのアクションは「何をすればいいか」が一読でわかる具体的な行動にする

以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{
  "career_paths": [
    {
      "title": "キャリアパス名",
      "match_score": 85,
      "salary_range": { "min": 400, "max": 600, "unit": "万円" },
      "description": "このパスの概要（2〜3文、高校生にもわかる言葉で）",
      "why_recommended": "推薦理由（かんたんな言葉で）",
      "roadmap": [
        { "step": 1, "period": "0〜3ヶ月", "action": "具体的にやること（専門用語なし）" }
      ],
      "required_skills": ["スキル1", "スキル2"],
      "pros": ["メリット1（わかりやすく）", "メリット2"],
      "cons": ["デメリット1（わかりやすく）"],
      "risks": "気をつけたいこと（やさしい言葉で）"
    }
  ],
  "skill_analysis": {
    "current_skills": { "スキル名": 8 },
    "target_skills": { "スキル名": 5 }
  },
  "overall_advice": "全体的なアドバイス（3〜5文、高校生の友だちに話すようなやさしい口調で）"
}

ルール：
- career_paths は2〜3個提示する
- match_score は 0〜100 の整数
- salary_range の min/max は万円単位の整数
- roadmap は3〜5ステップ
- current_skills / target_skills のスコアは 1〜10 の整数
- overall_advice は3〜5文で簡潔にまとめる
- すべてのテキストは高校生が読んですぐわかるレベルにすること`;

// ---------- ユーザーメッセージ生成 ----------
function buildUserMessage(data: DiagnosisData): string {
  const lines = [
    "以下の診断データに基づいてキャリアプランを提案してください。",
    "",
    "【基本情報】",
    `年齢層: ${data.ageRange}`,
    `最終学歴: ${data.education}`,
    `就業状況: ${data.employmentStatus}`,
    "",
    "【経歴・スキル】",
    `職種: ${data.jobType}${data.jobType === "その他" && data.jobTypeOther ? `（${data.jobTypeOther}）` : ""}`,
    `業界: ${data.industry}`,
    `経験年数: ${data.experienceYears}`,
    `得意なスキル: ${data.skills.join("、")}`,
  ];

  if (data.certifications) {
    lines.push(`保有資格: ${data.certifications}`);
  }

  lines.push(
    "",
    "【希望・価値観】",
    `キャリアの悩み: ${data.concerns.join("、")}`,
    `重視する価値観: ${data.values.join("、")}`,
  );

  if (data.interests) {
    lines.push(`興味のある分野: ${data.interests}`);
  }

  lines.push(`転職の緊急度: ${data.urgency}`);

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
