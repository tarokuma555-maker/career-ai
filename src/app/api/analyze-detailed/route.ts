import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { kv } from "@vercel/kv";
import type { StoredDiagnosis } from "@/lib/agent-types";
import type { DetailedLifePlan } from "@/lib/self-analysis-types";

const SYSTEM_PROMPT = `あなたは経験豊富な転職エージェントの分析AIです。
求職者の診断データ、AI分析結果、および詳細な自己分析アンケートの回答を踏まえて、
転職エージェントが求職者に提示するための包括的なキャリア・人生プランを作成してください。

以下のJSON形式のみで回答してください。JSON以外のテキストは含めないでください。

{
  "personalProfile": {
    "summary": "求職者の人物像の要約（3〜5文）",
    "coreStrengths": ["強み1", "強み2", "強み3"],
    "personalityType": "パーソナリティタイプの説明",
    "workStyle": "適した働き方の説明"
  },
  "careerStrategy": {
    "shortTerm": {
      "period": "0〜6ヶ月",
      "goals": ["短期目標1", "短期目標2"],
      "actions": ["具体的なアクション1", "具体的なアクション2"]
    },
    "midTerm": {
      "period": "6ヶ月〜2年",
      "goals": ["中期目標1", "中期目標2"],
      "actions": ["具体的なアクション1", "具体的なアクション2"]
    },
    "longTerm": {
      "period": "2年〜5年",
      "goals": ["長期目標1", "長期目標2"],
      "actions": ["具体的なアクション1", "具体的なアクション2"]
    }
  },
  "lifePlan": {
    "financialPlan": "家賃・年収希望を踏まえた経済面のアドバイス",
    "familyPlan": "結婚・子どもの希望を踏まえたライフプランアドバイス",
    "lifestyleAdvice": "趣味・生活の優先度を踏まえたアドバイス",
    "balanceStrategy": "仕事とプライベートのバランス戦略"
  },
  "gapAnalysis": {
    "currentVsDesired": [
      {
        "area": "分野名（例：年収、勤務地、スキル等）",
        "current": "現在の状況",
        "desired": "希望する状況",
        "action": "ギャップを埋めるための具体策"
      }
    ]
  },
  "detailedRecommendations": {
    "jobRecommendations": [
      {
        "title": "推薦職種名",
        "reason": "推薦理由",
        "salary": "想定年収レンジ",
        "fit": 85
      }
    ],
    "skillDevelopment": [
      {
        "skill": "身につけるべきスキル",
        "method": "具体的な学習方法",
        "timeline": "習得目安期間"
      }
    ],
    "networkingAdvice": "人脈構築のアドバイス"
  },
  "agentTalkingPoints": [
    "エージェントが面談で伝えるべきポイント1",
    "エージェントが面談で伝えるべきポイント2"
  ],
  "overallSummary": "総合的な所見と推奨アクション（5〜8文）"
}

ルール：
- gapAnalysis.currentVsDesired は4〜8個
- jobRecommendations は2〜4個
- skillDevelopment は3〜5個
- agentTalkingPoints は4〜6個
- 自己分析の回答内容（強み、趣味、価値観、遭難シナリオの選択等）を活かした分析をする
- 求職者の人生設計（結婚、子ども、家賃、優先度）と希望条件を踏まえた現実的なプランを提示
- すべてプロフェッショナルな転職エージェントの視点で記述する`;

function buildUserMessage(stored: StoredDiagnosis): string {
  const d = stored.diagnosisData;
  const r = stored.analysisResult;
  const s = stored.selfAnalysis!;

  const lines = [
    "以下の求職者データを総合的に分析し、詳細なキャリア・人生プランを作成してください。",
    "",
    "=== 基本診断データ ===",
    `年齢層: ${d.ageRange}`,
    `就業状況: ${d.employmentStatus}`,
    `職種: ${d.jobType}${d.jobType === "その他" && d.jobTypeOther ? `（${d.jobTypeOther}）` : ""}`,
    `気になること: ${d.concerns.join("、")}`,
    `大事にしたいこと: ${d.values.join("、")}`,
    "",
    "=== AI分析結果 ===",
    `キャリアパス: ${r.career_paths.map((p) => `${p.title}(${p.match_score}点)`).join("、")}`,
    `アドバイス: ${r.overall_advice}`,
    "",
    "=== 自己分析アンケート ===",
    `氏名: ${s.name}`,
    "",
    "【強みと適性】",
    `自然に得意なこと: ${s.naturalStrengths.join("、")}${s.naturalStrengthsOther ? `、${s.naturalStrengthsOther}` : ""}`,
    `褒められた経験: ${s.praisedExperiences.join("、")}${s.praisedExperiencesOther ? `、${s.praisedExperiencesOther}` : ""}`,
    `強み: ${s.strengths.join("、")}${s.strengthsOther ? `、${s.strengthsOther}` : ""}`,
    "",
    "【趣味・適性】",
    `集中できる趣味: ${s.focusedHobbies.join("、")}${s.focusedHobbiesOther ? `、${s.focusedHobbiesOther}` : ""}`,
    `3年以上の趣味: ${s.longTermHobbies.join("、")}${s.longTermHobbiesOther ? `、${s.longTermHobbiesOther}` : ""}`,
    `教えられるスキル: ${s.teachableSkills.join("、")}${s.teachableSkillsOther ? `、${s.teachableSkillsOther}` : ""}`,
    "",
    "【経験・価値観】",
    `感謝された経験: ${s.appreciatedExperiences.join("、")}${s.appreciatedExperiencesOther ? `、${s.appreciatedExperiencesOther}` : ""}`,
    `遭難シナリオの選択: ${s.survivalScenario}${s.survivalScenarioOther ? `（${s.survivalScenarioOther}）` : ""}`,
    `遭難シナリオの理由: ${s.survivalScenarioReason}`,
    "",
    "【仕事の価値観】",
    `大切にしたいこと: 1位=${s.workValue1}, 2位=${s.workValue2}, 3位=${s.workValue3}`,
    `働くとは: 1位=${s.workMeaning1}, 2位=${s.workMeaning2}, 3位=${s.workMeaning3}`,
    "",
    "【人生設計】",
    `10年後の結婚: ${s.marriage}`,
    `10年後の子ども: ${s.children}${s.childrenOther ? `（${s.childrenOther}）` : ""}`,
    `10年後の家賃: ${s.rent}${s.rentOther ? `（${s.rentOther}）` : ""}`,
    `一番大事にしたいこと: ${s.priority}${s.priorityOther ? `（${s.priorityOther}）` : ""}`,
    `仕事一筋度: ${s.workDedication}/5 (1=仕事, 5=それ以外)`,
    `希望年収: ${s.desiredIncome}${s.desiredIncomeOther ? `（${s.desiredIncomeOther}）` : ""}`,
    "",
    "【希望条件】",
    `企業知名度の希望: ${s.desiredCompanyFame}/5 (1=知名度, 5=ベンチャー)`,
    `身に着けたいスキル: ${s.desiredSkills.join("、")}${s.desiredSkillsOther ? `、${s.desiredSkillsOther}` : ""}`,
    `勤務時間: ${s.desiredWorkHours}${s.desiredWorkHoursOther ? `（${s.desiredWorkHoursOther}）` : ""}`,
    `勤務地: ${s.desiredLocation}${s.desiredLocationOther ? `（${s.desiredLocationOther}）` : ""}`,
    `残業: ${s.desiredOvertime}`,
    `希望職種: ${s.desiredJobTypes.join("、")}${s.desiredJobTypesOther ? `、${s.desiredJobTypesOther}` : ""}`,
    `希望業種: ${s.desiredIndustries.join("、")}${s.desiredIndustriesOther ? `、${s.desiredIndustriesOther}` : ""}`,
    `希望の職場雰囲気: ${s.desiredAtmosphere}${s.desiredAtmosphereOther ? `（${s.desiredAtmosphereOther}）` : ""}`,
    "",
    "【現在の状況】",
    `現在の年収: ${s.currentIncome}${s.currentIncomeOther ? `（${s.currentIncomeOther}）` : ""}`,
    `現在の企業知名度: ${s.currentCompanyFame}/5`,
    `持っているスキル: ${s.currentSkills.join("、")}${s.currentSkillsOther ? `、${s.currentSkillsOther}` : ""}`,
    `勤務時間の融通: ${s.currentWorkHoursFlexibility}/5 (1=融通利く, 5=利かない)`,
    `勤務地: ${s.currentLocation}${s.currentLocationOther ? `（${s.currentLocationOther}）` : ""}`,
    `残業: ${s.currentOvertime}`,
    `職種: ${s.currentJobType}${s.currentJobTypeOther ? `（${s.currentJobTypeOther}）` : ""}`,
    `業種: ${s.currentIndustry}${s.currentIndustryOther ? `（${s.currentIndustryOther}）` : ""}`,
    `職場雰囲気: ${s.currentAtmosphere}${s.currentAtmosphereOther ? `（${s.currentAtmosphereOther}）` : ""}`,
    "",
    "【転職改善ポイント】",
    `1位: ${s.improvement1}${s.improvement1Other ? `（${s.improvement1Other}）` : ""}`,
    `2位: ${s.improvement2}${s.improvement2Other ? `（${s.improvement2Other}）` : ""}`,
    `3位: ${s.improvement3}${s.improvement3Other ? `（${s.improvement3Other}）` : ""}`,
    `4位: ${s.improvement4}${s.improvement4Other ? `（${s.improvement4Other}）` : ""}`,
    `5位: ${s.improvement5}${s.improvement5Other ? `（${s.improvement5Other}）` : ""}`,
  ];

  return lines.join("\n");
}

function parseResponse(text: string): DetailedLifePlan {
  try {
    return JSON.parse(text) as DetailedLifePlan;
  } catch {
    // fallback
  }

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as DetailedLifePlan;
    } catch {
      // next fallback
    }
  }

  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1)) as DetailedLifePlan;
    } catch {
      // parse failed
    }
  }

  throw new Error("詳細プランの応答をパースできませんでした");
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

  if (!stored.selfAnalysis) {
    return NextResponse.json(
      { error: "自己分析データがありません。" },
      { status: 400 },
    );
  }

  if (stored.detailedPlan) {
    return NextResponse.json(stored.detailedPlan);
  }

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(stored) },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "AIからの応答が空でした。" },
        { status: 502 },
      );
    }

    const plan = parseResponse(text);

    try {
      stored.detailedPlan = plan;
      await kv.set(kvKey, JSON.stringify(stored), {
        ex: 60 * 60 * 24 * 90,
      });
    } catch (err) {
      console.error("KV write error (non-fatal):", err);
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return NextResponse.json(
      { error: "詳細プランの生成に失敗しました。" },
      { status: 500 },
    );
  }
}
