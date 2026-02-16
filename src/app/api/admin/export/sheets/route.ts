import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { kv } from "@vercel/kv";
import { getGoogleAuth } from "@/lib/google-auth";
import type { StoredDiagnosis } from "@/lib/agent-types";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
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

  // KV からデータ取得
  let stored: StoredDiagnosis;
  try {
    const raw = await kv.get<string>(
      `career-ai:diagnosis:${body.diagnosisId}`,
    );
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

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    const diag = stored.diagnosisData;
    const result = stored.analysisResult;
    const sa = stored.selfAnalysis;
    const agent = stored.agentAnalysis;
    const plan = stored.detailedPlan;
    const name = diag.name || "名前未登録";
    const dateStr = formatDate(stored.createdAt);

    // ---------- シートデータ構築 ----------

    // 1. 求職者情報シート
    const infoRows: (string | number)[][] = [
      ["項目", "内容"],
      ["氏名", name],
      ["年齢層", diag.ageRange],
      [
        "職種",
        diag.jobType === "その他" && diag.jobTypeOther
          ? diag.jobTypeOther
          : diag.jobType,
      ],
      ["就業状況", diag.employmentStatus],
      ["気になること", diag.concerns.join("、")],
      ["大事にしたいこと", diag.values.join("、")],
      ["診断日時", new Date(stored.createdAt).toLocaleString("ja-JP")],
    ];

    // 2. 基本分析シート
    const analysisRows: (string | number)[][] = [
      [
        "キャリアパス",
        "マッチ度",
        "年収(最低)",
        "年収(最高)",
        "説明",
        "推薦理由",
      ],
    ];
    for (const path of result.career_paths) {
      analysisRows.push([
        path.title,
        path.match_score,
        path.salary_range.min,
        path.salary_range.max,
        path.description,
        path.why_recommended,
      ]);
    }
    analysisRows.push([], ["スキル", "現在", "目標"]);
    const skillKeys = Array.from(
      new Set([
        ...Object.keys(result.skill_analysis.current_skills),
        ...Object.keys(result.skill_analysis.target_skills),
      ]),
    );
    for (const skill of skillKeys) {
      analysisRows.push([
        skill,
        result.skill_analysis.current_skills[skill] ?? 0,
        result.skill_analysis.target_skills[skill] ?? 0,
      ]);
    }
    analysisRows.push([], ["AIアドバイス"], [result.overall_advice]);

    // 3. 自己分析シート
    const selfRows: (string | number)[][] = [["項目", "回答"]];
    if (sa) {
      selfRows.push(
        ["氏名", sa.name],
        [
          "自然に得意なこと",
          sa.naturalStrengths.join("、") +
            (sa.naturalStrengthsOther ? `、${sa.naturalStrengthsOther}` : ""),
        ],
        [
          "褒められた経験",
          sa.praisedExperiences.join("、") +
            (sa.praisedExperiencesOther
              ? `、${sa.praisedExperiencesOther}`
              : ""),
        ],
        [
          "強み",
          (sa.strengths?.join("、") || "") +
            (sa.strengthsOther ? `、${sa.strengthsOther}` : ""),
        ],
        [
          "集中できる趣味",
          sa.focusedHobbies.join("、") +
            (sa.focusedHobbiesOther ? `、${sa.focusedHobbiesOther}` : ""),
        ],
        [
          "3年以上の趣味",
          sa.longTermHobbies.join("、") +
            (sa.longTermHobbiesOther ? `、${sa.longTermHobbiesOther}` : ""),
        ],
        [
          "教えられるスキル",
          sa.teachableSkills.join("、") +
            (sa.teachableSkillsOther ? `、${sa.teachableSkillsOther}` : ""),
        ],
        [
          "感謝された経験",
          sa.appreciatedExperiences.join("、") +
            (sa.appreciatedExperiencesOther
              ? `、${sa.appreciatedExperiencesOther}`
              : ""),
        ],
        [
          "遭難シナリオ",
          sa.survivalScenario +
            (sa.survivalScenarioOther ? `（${sa.survivalScenarioOther}）` : ""),
        ],
        ["遭難シナリオの理由", sa.survivalScenarioReason],
        [
          "大切にしたいこと",
          `1位=${sa.workValue1}, 2位=${sa.workValue2}, 3位=${sa.workValue3}`,
        ],
        [
          "働くとは",
          `1位=${sa.workMeaning1}, 2位=${sa.workMeaning2}, 3位=${sa.workMeaning3}`,
        ],
        ["結婚", sa.marriage],
        [
          "子ども",
          sa.children + (sa.childrenOther ? `（${sa.childrenOther}）` : ""),
        ],
        ["家賃", sa.rent + (sa.rentOther ? `（${sa.rentOther}）` : "")],
        [
          "一番大事なこと",
          sa.priority + (sa.priorityOther ? `（${sa.priorityOther}）` : ""),
        ],
        ["仕事一筋度", `${sa.workDedication}/5`],
        [
          "希望年収",
          sa.desiredIncome +
            (sa.desiredIncomeOther ? `（${sa.desiredIncomeOther}）` : ""),
        ],
        ["希望企業知名度", `${sa.desiredCompanyFame}/5`],
        [
          "希望スキル",
          sa.desiredSkills.join("、") +
            (sa.desiredSkillsOther ? `、${sa.desiredSkillsOther}` : ""),
        ],
        ["希望勤務時間", sa.desiredWorkHours],
        ["希望勤務地", sa.desiredLocation],
        ["希望残業", sa.desiredOvertime],
        ["希望職種", sa.desiredJobTypes.join("、")],
        ["希望業種", sa.desiredIndustries.join("、")],
        ["希望雰囲気", sa.desiredAtmosphere],
        [
          "現在の年収",
          sa.currentIncome +
            (sa.currentIncomeOther ? `（${sa.currentIncomeOther}）` : ""),
        ],
        ["現在の企業知名度", `${sa.currentCompanyFame}/5`],
        [
          "現在のスキル",
          sa.currentSkills.join("、") +
            (sa.currentSkillsOther ? `、${sa.currentSkillsOther}` : ""),
        ],
        ["現在の勤務時間融通", `${sa.currentWorkHoursFlexibility}/5`],
        ["現在の勤務地", sa.currentLocation],
        ["現在の残業", sa.currentOvertime],
        ["現在の職種", sa.currentJobType],
        ["現在の業種", sa.currentIndustry],
        ["現在の雰囲気", sa.currentAtmosphere],
        ["改善1位", sa.improvement1],
        ["改善2位", sa.improvement2],
        ["改善3位", sa.improvement3],
        ["改善4位", sa.improvement4],
        ["改善5位", sa.improvement5],
      );
    } else {
      selfRows.push(["", "未回答"]);
    }

    // 4. エージェント分析シート
    const agentRows: (string | number)[][] = [];
    if (agent) {
      agentRows.push(["エージェント所見"], [agent.agent_summary], []);
      agentRows.push([
        "キャリアプラン",
        "マッチ度",
        "年収範囲",
        "難易度",
        "推薦理由",
      ]);
      for (const p of agent.detailed_career_plans) {
        agentRows.push([
          p.title,
          p.match_score,
          `${p.salary_range.min}〜${p.salary_range.max}${p.salary_range.unit}`,
          p.transition_difficulty,
          p.why_recommended,
        ]);
      }
      agentRows.push(
        [],
        ["スキルギャップ", "現在", "目標", "ギャップ", "優先度", "改善方法"],
      );
      for (const sg of agent.skill_gap_analysis) {
        agentRows.push([
          sg.skill_name,
          sg.current_level,
          sg.target_level,
          sg.gap,
          sg.priority,
          sg.improvement_method,
        ]);
      }
      agentRows.push([], ["市場動向"]);
      agentRows.push(["業界トレンド", agent.market_insights.industry_trend]);
      agentRows.push(["需要", agent.market_insights.demand_level]);
      agentRows.push(["競争", agent.market_insights.competition_level]);
      agentRows.push(["見通し", agent.market_insights.future_outlook]);
      agentRows.push([], ["年収交渉"]);
      agentRows.push([
        "市場レンジ",
        `${agent.salary_negotiation.current_market_range.min}〜${agent.salary_negotiation.current_market_range.max}万円`,
      ]);
      agentRows.push([
        "交渉ポイント",
        agent.salary_negotiation.negotiation_points.join(" / "),
      ]);
    } else {
      agentRows.push(["", "未生成"]);
    }

    // 5. 詳細プランシート
    const planRows: (string | number)[][] = [];
    if (plan) {
      planRows.push(["パーソナルプロフィール"]);
      planRows.push([plan.personalProfile.summary]);
      planRows.push([
        "コア強み",
        plan.personalProfile.coreStrengths.join("、"),
      ]);
      planRows.push([
        "パーソナリティ",
        plan.personalProfile.personalityType,
      ]);
      planRows.push(["働き方", plan.personalProfile.workStyle]);
      planRows.push([], ["キャリア戦略"]);
      for (const key of ["shortTerm", "midTerm", "longTerm"] as const) {
        const s = plan.careerStrategy[key];
        const labels = { shortTerm: "短期", midTerm: "中期", longTerm: "長期" };
        planRows.push([`${labels[key]}（${s.period}）`]);
        planRows.push(["目標", s.goals.join(" / ")]);
        planRows.push(["アクション", s.actions.join(" / ")]);
      }
      planRows.push([], ["ライフプラン"]);
      planRows.push(["経済面", plan.lifePlan.financialPlan]);
      planRows.push(["家庭", plan.lifePlan.familyPlan]);
      planRows.push([
        "ライフスタイル",
        plan.lifePlan.lifestyleAdvice,
      ]);
      planRows.push(["バランス", plan.lifePlan.balanceStrategy]);
      planRows.push([], ["ギャップ分析"], ["分野", "現在", "希望", "アクション"]);
      for (const g of plan.gapAnalysis.currentVsDesired) {
        planRows.push([g.area, g.current, g.desired, g.action]);
      }
      planRows.push([], ["推奨職種"], ["職種", "理由", "年収", "適合度"]);
      for (const j of plan.detailedRecommendations.jobRecommendations) {
        planRows.push([j.title, j.reason, j.salary, j.fit]);
      }
      planRows.push([], ["総合所見"], [plan.overallSummary]);
    } else {
      planRows.push(["", "未生成"]);
    }

    // ---------- スプレッドシート作成 ----------
    const title = `${name}_求職者情報_${dateStr}`;
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          { properties: { title: "求職者情報" } },
          { properties: { title: "基本分析" } },
          { properties: { title: "自己分析" } },
          { properties: { title: "エージェント分析" } },
          { properties: { title: "詳細プラン" } },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId!;

    // データ書き込み
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: "求職者情報!A1", values: infoRows },
          { range: "基本分析!A1", values: analysisRows },
          { range: "自己分析!A1", values: selfRows },
          { range: "エージェント分析!A1", values: agentRows },
          { range: "詳細プラン!A1", values: planRows },
        ],
      },
    });

    // ヘッダー行を太字にする
    const sheetIds = spreadsheet.data.sheets!.map(
      (s) => s.properties!.sheetId!,
    );
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: sheetIds.map((sheetId) => ({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: {
                  red: 0.9,
                  green: 0.93,
                  blue: 1.0,
                },
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        })),
      },
    });

    // 共有設定: リンクを知っている全員が閲覧可
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Google Sheets export error:", err);
    return NextResponse.json(
      { error: "スプレッドシートの作成に失敗しました。" },
      { status: 500 },
    );
  }
}
