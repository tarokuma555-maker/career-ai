import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import type { DiagnosisData } from "@/lib/diagnosis-schema";
import type { AnalysisResult } from "@/lib/types";
import type { StoredDiagnosis, DiagnosisIndexEntry } from "@/lib/agent-types";

export const maxDuration = 60;

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
const SYSTEM_PROMPT = `あなたは経験豊富な日本のキャリアコンサルタントです。
以下の特徴を持ちます：
- 10年以上の人材業界経験を持つプロフェッショナル
- 日本の労働市場・各業界の動向に精通している
- 求職者の適性を多角的に分析し、現実的かつ戦略的なキャリア提案ができる
- 特定の企業や求人を推薦せず、中立的な立場を保つ

以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{
  "career_paths": [
    {
      "title": "キャリアパス名称",
      "match_score": 85,
      "salary_range": { "min": 400, "max": 600, "unit": "万円" },
      "description": "職務内容・業界における位置づけ・キャリアとしての特徴（2〜4文で詳述）",
      "why_recommended": "求職者の経歴・スキル・志向性を踏まえた推薦理由（2〜3文）",
      "roadmap": [
        { "step": 1, "period": "0〜3ヶ月", "action": "具体的なアクション内容（実行可能な粒度で記述）" }
      ],
      "required_skills": ["必要スキル1", "必要スキル2"],
      "pros": ["メリット（具体的な根拠を含めて記述）"],
      "cons": ["デメリット・課題（リアルな観点で記述）"],
      "risks": "想定されるリスクと留意事項（1〜2文）"
    }
  ],
  "skill_analysis": {
    "current_skills": { "スキル名": 8 },
    "target_skills": { "スキル名": 5 }
  },
  "overall_advice": "総合的なキャリアアドバイス（4〜6文。市場動向・求職者の強み・改善点・推奨アクションを含む）"
}

ルール：
- career_paths は2〜3個提示する
- match_score は 0〜100 の整数（求職者の経歴・スキルとの適合度を厳密に評価）
- salary_range の min/max は万円単位の整数（市場実勢に基づく現実的な範囲）
- roadmap は4〜6ステップ（各ステップに具体的で実行可能なアクションを記載）
- current_skills / target_skills のスコアは 1〜10 の整数
- スキルは5〜8個（現在の職種に関連するスキルだけでなく、目標キャリアに必要なスキルも含める）
- pros / cons はそれぞれ3〜5個（表面的でなく業界実態に即した内容）
- overall_advice は市場環境・求職者のポジショニング・具体的な行動提案を含めた包括的な内容にする
- プロフェッショナルな転職エージェントの視点で、実務に役立つ分析を行う`;

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "サーバーの設定に問題があります。管理者にお問い合わせください。" },
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

  let diagnosisData: DiagnosisData;
  try {
    diagnosisData = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 }
    );
  }

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 16384,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(diagnosisData) },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "AIからの応答が空でした。再度お試しください。" },
        { status: 502 }
      );
    }

    const result = parseAnalysisResponse(text);

    // KV に診断データを保存（エージェント管理画面用）
    let diagnosisId: string | undefined;
    try {
      diagnosisId = nanoid(12);
      const stored: StoredDiagnosis = {
        diagnosisData,
        analysisResult: result,
        createdAt: Date.now(),
      };
      await kv.set(
        `career-ai:diagnosis:${diagnosisId}`,
        JSON.stringify(stored),
        { ex: 60 * 60 * 24 * 90 }, // 90日
      );
      const indexEntry: DiagnosisIndexEntry = {
        id: diagnosisId,
        createdAt: stored.createdAt,
        name: diagnosisData.name,
        ageRange: diagnosisData.ageRange,
        jobType:
          diagnosisData.jobType === "その他" && diagnosisData.jobTypeOther
            ? diagnosisData.jobTypeOther
            : diagnosisData.jobType,
        employmentStatus: diagnosisData.employmentStatus,
      };
      await kv.lpush("career-ai:diagnosis-index", JSON.stringify(indexEntry));
    } catch (err) {
      console.error("KV storage error (non-fatal):", err);
    }

    return NextResponse.json({ ...result, diagnosisId });
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
