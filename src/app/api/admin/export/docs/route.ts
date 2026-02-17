import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";
import { kv } from "@vercel/kv";
import type { StoredDiagnosis } from "@/lib/agent-types";
import { uploadToGoogleDrive } from "@/lib/google-drive";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function heading(
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1,
) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 300, after: 120 },
  });
}

/** ラベル: 値 を1行で表示（ラベル太字） */
function lv(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value, size: 22 }),
    ],
  });
}

function p(text: string, bold = false) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, bold, size: 22 })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 40 },
    style: undefined,
    children: undefined,
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
  });
}

/** 空行 */
function spacer() {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
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
    const diag = stored.diagnosisData;
    const result = stored.analysisResult;
    const sa = stored.selfAnalysis;
    const agent = stored.agentAnalysis;
    const plan = stored.detailedPlan;
    const name = diag.name || "名前未登録";
    const dateStr = formatDate(stored.createdAt);

    const children: Paragraph[] = [];

    // ===== タイトル =====
    children.push(
      new Paragraph({
        text: `${name} - 求職者情報`,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({ text: `作成日: ${dateStr}`, italics: true, color: "666666" }),
        ],
      }),
    );

    // ===== 求職者情報 =====
    children.push(heading("求職者情報"));
    children.push(lv("氏名", name));
    children.push(lv("年齢層", diag.ageRange));
    children.push(
      lv(
        "職種",
        diag.jobType === "その他" && diag.jobTypeOther
          ? diag.jobTypeOther
          : diag.jobType,
      ),
    );
    children.push(lv("就業状況", diag.employmentStatus));
    children.push(lv("気になること", diag.concerns.join("、")));
    children.push(lv("大事にしたいこと", diag.values.join("、")));
    children.push(
      lv("診断日時", new Date(stored.createdAt).toLocaleString("ja-JP")),
    );
    children.push(divider());

    // ===== 基本分析結果 =====
    children.push(heading("基本分析結果"));
    for (const path of result.career_paths) {
      children.push(
        heading(
          `${path.title}（マッチ度: ${path.match_score}点）`,
          HeadingLevel.HEADING_2,
        ),
      );
      children.push(
        lv(
          "年収",
          `${path.salary_range.min}〜${path.salary_range.max}${path.salary_range.unit}`,
        ),
      );
      children.push(p(path.description));
      children.push(lv("推薦理由", path.why_recommended));
      if (path.roadmap?.length > 0) {
        children.push(p("ロードマップ:", true));
        for (const step of path.roadmap) {
          children.push(bullet(`${step.period}: ${step.action}`));
        }
      }
      if (path.pros?.length > 0) {
        children.push(p("メリット:", true));
        for (const pr of path.pros) children.push(bullet(pr));
      }
      if (path.cons?.length > 0) {
        children.push(p("デメリット:", true));
        for (const c of path.cons) children.push(bullet(c));
      }
      if (path.risks) {
        children.push(lv("リスク", path.risks));
      }
    }

    // スキル分析
    children.push(heading("スキル分析", HeadingLevel.HEADING_2));
    const skillKeys = Array.from(
      new Set([
        ...Object.keys(result.skill_analysis.current_skills),
        ...Object.keys(result.skill_analysis.target_skills),
      ]),
    );
    for (const skill of skillKeys) {
      const current = result.skill_analysis.current_skills[skill] ?? 0;
      const target = result.skill_analysis.target_skills[skill] ?? 0;
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${skill}`, bold: true, size: 22 }),
            new TextRun({
              text: `  現在: ${current}  →  目標: ${target}`,
              size: 22,
            }),
          ],
        }),
      );
    }

    children.push(spacer());
    children.push(heading("AIアドバイス", HeadingLevel.HEADING_2));
    children.push(p(result.overall_advice));
    children.push(divider());

    // ===== 自己分析 =====
    if (sa) {
      children.push(heading("自己分析アンケート回答"));

      children.push(heading("強みと適性", HeadingLevel.HEADING_2));
      children.push(lv("自然に得意なこと", sa.naturalStrengths.join("、") + (sa.naturalStrengthsOther ? `、${sa.naturalStrengthsOther}` : "")));
      children.push(lv("褒められた経験", sa.praisedExperiences.join("、") + (sa.praisedExperiencesOther ? `、${sa.praisedExperiencesOther}` : "")));
      if (sa.strengths?.length) {
        children.push(lv("強み", sa.strengths.join("、") + (sa.strengthsOther ? `、${sa.strengthsOther}` : "")));
      }

      children.push(heading("趣味・適性", HeadingLevel.HEADING_2));
      children.push(lv("集中できる趣味", sa.focusedHobbies.join("、") + (sa.focusedHobbiesOther ? `、${sa.focusedHobbiesOther}` : "")));
      children.push(lv("3年以上の趣味", sa.longTermHobbies.join("、") + (sa.longTermHobbiesOther ? `、${sa.longTermHobbiesOther}` : "")));
      children.push(lv("教えられるスキル", sa.teachableSkills.join("、") + (sa.teachableSkillsOther ? `、${sa.teachableSkillsOther}` : "")));

      children.push(heading("経験・価値観", HeadingLevel.HEADING_2));
      children.push(lv("感謝された経験", sa.appreciatedExperiences.join("、") + (sa.appreciatedExperiencesOther ? `、${sa.appreciatedExperiencesOther}` : "")));
      children.push(lv("遭難シナリオ", sa.survivalScenario + (sa.survivalScenarioOther ? `（${sa.survivalScenarioOther}）` : "")));
      children.push(lv("理由", sa.survivalScenarioReason));

      children.push(heading("仕事の価値観", HeadingLevel.HEADING_2));
      children.push(lv("大切にしたいこと", `1位=${sa.workValue1}, 2位=${sa.workValue2}, 3位=${sa.workValue3}`));
      children.push(lv("働くとは", `1位=${sa.workMeaning1}, 2位=${sa.workMeaning2}, 3位=${sa.workMeaning3}`));

      children.push(heading("人生設計", HeadingLevel.HEADING_2));
      children.push(lv("結婚", sa.marriage));
      children.push(lv("子ども", sa.children + (sa.childrenOther ? `（${sa.childrenOther}）` : "")));
      children.push(lv("家賃", sa.rent + (sa.rentOther ? `（${sa.rentOther}）` : "")));
      children.push(lv("一番大事なこと", sa.priority + (sa.priorityOther ? `（${sa.priorityOther}）` : "")));
      children.push(lv("仕事一筋度", `${sa.workDedication}/5`));
      children.push(lv("希望年収", sa.desiredIncome + (sa.desiredIncomeOther ? `（${sa.desiredIncomeOther}）` : "")));

      children.push(heading("希望条件", HeadingLevel.HEADING_2));
      children.push(lv("企業知名度", `${sa.desiredCompanyFame}/5`));
      children.push(lv("勤務時間", sa.desiredWorkHours));
      children.push(lv("勤務地", sa.desiredLocation));
      children.push(lv("残業", sa.desiredOvertime));
      children.push(lv("職種", sa.desiredJobTypes.join("、")));
      children.push(lv("業種", sa.desiredIndustries.join("、")));
      children.push(lv("雰囲気", sa.desiredAtmosphere));

      children.push(heading("現在の状況", HeadingLevel.HEADING_2));
      children.push(lv("年収", sa.currentIncome + (sa.currentIncomeOther ? `（${sa.currentIncomeOther}）` : "")));
      children.push(lv("企業知名度", `${sa.currentCompanyFame}/5`));
      children.push(lv("勤務地", sa.currentLocation));
      children.push(lv("残業", sa.currentOvertime));
      children.push(lv("職種", sa.currentJobType));
      children.push(lv("業種", sa.currentIndustry));
      children.push(lv("雰囲気", sa.currentAtmosphere));

      children.push(heading("転職改善ポイント", HeadingLevel.HEADING_2));
      children.push(bullet(`1位: ${sa.improvement1}`));
      children.push(bullet(`2位: ${sa.improvement2}`));
      children.push(bullet(`3位: ${sa.improvement3}`));
      children.push(bullet(`4位: ${sa.improvement4}`));
      children.push(bullet(`5位: ${sa.improvement5}`));
      children.push(divider());
    }

    // ===== エージェント分析 =====
    if (agent) {
      children.push(heading("エージェント向け詳細分析"));
      children.push(heading("エージェント所見", HeadingLevel.HEADING_2));
      children.push(p(agent.agent_summary));

      for (const cp of agent.detailed_career_plans) {
        children.push(
          heading(
            `${cp.title}（マッチ度: ${cp.match_score}点）`,
            HeadingLevel.HEADING_2,
          ),
        );
        children.push(
          lv("年収", `${cp.salary_range.min}〜${cp.salary_range.max}${cp.salary_range.unit}`),
        );
        children.push(lv("難易度", cp.transition_difficulty));
        children.push(p(cp.detailed_description));
        children.push(lv("推薦理由", cp.why_recommended));
      }

      children.push(heading("スキルギャップ分析", HeadingLevel.HEADING_2));
      for (const sg of agent.skill_gap_analysis) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: `${sg.skill_name}`, bold: true, size: 22 }),
              new TextRun({
                text: `  現在: ${sg.current_level} → 目標: ${sg.target_level}（優先度: ${sg.priority}）`,
                size: 22,
              }),
            ],
          }),
        );
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 360 },
            children: [
              new TextRun({ text: `改善方法: ${sg.improvement_method}`, size: 20, color: "444444" }),
            ],
          }),
        );
      }

      children.push(heading("市場動向", HeadingLevel.HEADING_2));
      children.push(lv("業界トレンド", agent.market_insights.industry_trend));
      children.push(lv("需要", agent.market_insights.demand_level));
      children.push(lv("競争", agent.market_insights.competition_level));
      children.push(lv("見通し", agent.market_insights.future_outlook));

      children.push(heading("年収交渉", HeadingLevel.HEADING_2));
      children.push(
        lv(
          "市場レンジ",
          `${agent.salary_negotiation.current_market_range.min}〜${agent.salary_negotiation.current_market_range.max}万円`,
        ),
      );
      children.push(p("交渉ポイント:", true));
      for (const np of agent.salary_negotiation.negotiation_points) {
        children.push(bullet(np));
      }
      children.push(divider());
    }

    // ===== 詳細プラン =====
    if (plan) {
      children.push(heading("詳細キャリア・人生プラン"));

      children.push(heading("パーソナルプロフィール", HeadingLevel.HEADING_2));
      children.push(p(plan.personalProfile.summary));
      children.push(lv("コア強み", plan.personalProfile.coreStrengths.join("、")));
      children.push(lv("パーソナリティ", plan.personalProfile.personalityType));
      children.push(lv("適した働き方", plan.personalProfile.workStyle));

      children.push(heading("キャリア戦略", HeadingLevel.HEADING_2));
      for (const key of ["shortTerm", "midTerm", "longTerm"] as const) {
        const s = plan.careerStrategy[key];
        const labels = { shortTerm: "短期", midTerm: "中期", longTerm: "長期" };
        children.push(
          new Paragraph({
            spacing: { before: 160, after: 80 },
            children: [
              new TextRun({
                text: `【${labels[key]}】${s.period}`,
                bold: true,
                size: 24,
                color: "4472C4",
              }),
            ],
          }),
        );
        children.push(p("目標:", true));
        for (const g of s.goals) children.push(bullet(g));
        children.push(p("アクション:", true));
        for (const a of s.actions) children.push(bullet(a));
      }

      children.push(heading("ライフプラン", HeadingLevel.HEADING_2));
      children.push(lv("経済面", plan.lifePlan.financialPlan));
      children.push(lv("家庭", plan.lifePlan.familyPlan));
      children.push(lv("ライフスタイル", plan.lifePlan.lifestyleAdvice));
      children.push(lv("バランス", plan.lifePlan.balanceStrategy));

      children.push(heading("ギャップ分析", HeadingLevel.HEADING_2));
      for (const g of plan.gapAnalysis.currentVsDesired) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: `${g.area}`, bold: true, size: 22 }),
            ],
          }),
        );
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            indent: { left: 360 },
            children: [
              new TextRun({ text: "現在: ", bold: true, size: 20 }),
              new TextRun({ text: g.current, size: 20 }),
              new TextRun({ text: "  →  希望: ", bold: true, size: 20 }),
              new TextRun({ text: g.desired, size: 20 }),
            ],
          }),
        );
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            indent: { left: 360 },
            children: [
              new TextRun({ text: "アクション: ", bold: true, size: 20 }),
              new TextRun({ text: g.action, size: 20 }),
            ],
          }),
        );
      }

      children.push(heading("推奨職種", HeadingLevel.HEADING_2));
      for (const j of plan.detailedRecommendations.jobRecommendations) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: `${j.title}`, bold: true, size: 22 }),
              new TextRun({ text: `（年収: ${j.salary} / 適合度: ${j.fit}）`, size: 20, color: "555555" }),
            ],
          }),
        );
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            indent: { left: 360 },
            children: [
              new TextRun({ text: j.reason, size: 20 }),
            ],
          }),
        );
      }

      children.push(heading("総合所見", HeadingLevel.HEADING_2));
      children.push(p(plan.overallSummary));
    }

    // ===== ドキュメント生成 =====
    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);
    const displayName = `${name}_求職者情報_${dateStr}`;
    const fileName = `${displayName}.docx`;

    // Google Drive にアップロードを試みる
    try {
      const fileId = await uploadToGoogleDrive(
        uint8,
        displayName,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.google-apps.document",
      );
      return NextResponse.json({
        url: `https://docs.google.com/document/d/${fileId}/edit`,
        type: "google_docs",
      });
    } catch (driveErr) {
      console.warn("Google Drive upload skipped:", driveErr instanceof Error ? driveErr.message : driveErr);
    }

    // フォールバック: .docx バイナリを返す
    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (err) {
    console.error("Word export error:", err);
    return NextResponse.json(
      { error: "Wordドキュメントの作成に失敗しました。" },
      { status: 500 },
    );
  }
}
