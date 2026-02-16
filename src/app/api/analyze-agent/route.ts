import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { kv } from "@vercel/kv";
import type { StoredDiagnosis } from "@/lib/agent-types";
import type { AgentAnalysisResult } from "@/lib/agent-types";

const AGENT_SYSTEM_PROMPT = `あなたは経験豊富な転職エージェントの分析AIです。
以下の求職者の診断データとAI分析結果を踏まえて、転職エージェントが求職者にアドバイスするための詳細な分析レポートを作成してください。

エージェント向けの視点で、プロフェッショナルな表現で以下を含めてください。

以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{
  "detailed_career_plans": [
    {
      "title": "キャリアパス名",
      "match_score": 85,
      "salary_range": { "min": 400, "max": 600, "unit": "万円", "market_average": 500 },
      "detailed_description": "このキャリアパスの詳細な説明（2〜3文）",
      "why_recommended": "推薦理由（エージェント視点で具体的に）",
      "roadmap": [
        { "step": 1, "period": "0〜3ヶ月", "action": "アクション名", "detail": "具体的な実行内容の詳細" }
      ],
      "required_skills": ["スキル1"],
      "skill_development_plan": "スキル開発の具体的なプラン",
      "pros": ["メリット"],
      "cons": ["デメリット"],
      "risks": "リスク説明",
      "specific_recommendations": ["エージェントとして求職者に伝えるべき具体的アドバイス"],
      "transition_difficulty": "easy|moderate|challenging"
    }
  ],
  "skill_gap_analysis": [
    {
      "skill_name": "スキル名",
      "current_level": 5,
      "target_level": 8,
      "gap": 3,
      "priority": "high|medium|low",
      "improvement_method": "具体的な改善方法",
      "estimated_time": "習得に必要な期間"
    }
  ],
  "market_insights": {
    "industry_trend": "業界のトレンド分析",
    "demand_level": "需要レベルの説明",
    "competition_level": "競争環境の説明",
    "future_outlook": "将来の見通し",
    "recommended_timing": "転職の推奨タイミング"
  },
  "salary_negotiation": {
    "current_market_range": { "min": 400, "max": 700 },
    "negotiation_points": ["交渉で使えるポイント"],
    "leverage_factors": ["求職者の強みとなる要素"],
    "timing_advice": "年収交渉のタイミングアドバイス"
  },
  "interview_preparation": {
    "key_questions": ["想定される面接質問"],
    "talking_points": ["アピールすべきポイント"],
    "potential_concerns": ["面接官が懸念しそうな点"],
    "presentation_tips": ["面接での見せ方のコツ"]
  },
  "red_flags": [
    {
      "flag": "注意すべき点",
      "severity": "high|medium|low",
      "mitigation": "対策方法"
    }
  ],
  "agent_summary": "エージェントとしての総合的な所見と推奨アクション（3〜5文）"
}

ルール：
- detailed_career_plans は2〜3個提示する
- skill_gap_analysis は4〜6個
- red_flags は2〜4個
- すべてプロフェッショナルな転職エージェントの視点で記述する
- 具体的で実践的なアドバイスを心がける`;

function buildAgentUserMessage(stored: StoredDiagnosis): string {
  const d = stored.diagnosisData;
  const r = stored.analysisResult;

  const lines = [
    "以下の求職者データとAI分析結果を踏まえて、エージェント向けの詳細分析を行ってください。",
    "",
    "【求職者情報】",
    `年齢層: ${d.ageRange}`,
    `就業状況: ${d.employmentStatus}`,
    `職種: ${d.jobType}${d.jobType === "その他" && d.jobTypeOther ? `（${d.jobTypeOther}）` : ""}`,
    `気になること: ${d.concerns.join("、")}`,
    `大事にしたいこと: ${d.values.join("、")}`,
    "",
    "【AI分析結果（求職者向け）】",
    `キャリアパス提案: ${r.career_paths.map((p) => `${p.title}(${p.match_score}点)`).join("、")}`,
    `全体アドバイス: ${r.overall_advice}`,
  ];

  return lines.join("\n");
}

function parseAgentResponse(text: string): AgentAnalysisResult {
  try {
    return JSON.parse(text) as AgentAnalysisResult;
  } catch {
    // fallback
  }

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as AgentAnalysisResult;
    } catch {
      // next fallback
    }
  }

  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1)) as AgentAnalysisResult;
    } catch {
      // parse failed
    }
  }

  throw new Error("エージェント分析の応答をパースできませんでした");
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "サーバーの設定に問題があります。" },
      { status: 500 },
    );
  }

  let body: { diagnosisId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.diagnosisId) {
    return NextResponse.json(
      { error: "診断IDが指定されていません。" },
      { status: 400 },
    );
  }

  // KV から診断データを取得
  const kvKey = `career-ai:diagnosis:${body.diagnosisId}`;
  let stored: StoredDiagnosis;
  try {
    const raw = await kv.get<string>(kvKey);
    if (!raw) {
      return NextResponse.json(
        { error: "診断データが見つかりません。" },
        { status: 404 },
      );
    }
    stored = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error("KV read error:", err);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 },
    );
  }

  // 既に生成済みの場合は返却
  if (stored.agentAnalysis) {
    return NextResponse.json(stored.agentAnalysis);
  }

  // OpenAI でエージェント向け分析を生成
  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 8192,
      messages: [
        { role: "system", content: AGENT_SYSTEM_PROMPT },
        { role: "user", content: buildAgentUserMessage(stored) },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "AIからの応答が空でした。" },
        { status: 502 },
      );
    }

    const agentResult = parseAgentResponse(text);

    // KV に保存
    try {
      stored.agentAnalysis = agentResult;
      await kv.set(kvKey, JSON.stringify(stored), {
        ex: 60 * 60 * 24 * 90,
      });
    } catch (err) {
      console.error("KV write error (non-fatal):", err);
    }

    return NextResponse.json(agentResult);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return NextResponse.json(
      { error: "分析の生成に失敗しました。" },
      { status: 500 },
    );
  }
}
