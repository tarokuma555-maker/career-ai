import { NextRequest, NextResponse } from "next/server";
import { google, docs_v1 } from "googleapis";
import { kv } from "@vercel/kv";
import { getGoogleAuth } from "@/lib/google-auth";
import type { StoredDiagnosis } from "@/lib/agent-types";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Google Docs API のリクエストを順番に構築するヘルパー。
 * 挿入は末尾(endOfBody)に追加していく。
 */
class DocBuilder {
  requests: docs_v1.Schema$Request[] = [];
  private index = 1; // ドキュメントの最初のインデックス

  heading(text: string, level: 1 | 2 | 3 = 1) {
    this.requests.push({
      insertText: {
        location: { index: this.index },
        text: text + "\n",
      },
    });
    this.requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: this.index,
          endIndex: this.index + text.length + 1,
        },
        paragraphStyle: {
          namedStyleType: `HEADING_${level}` as docs_v1.Schema$ParagraphStyle["namedStyleType"],
        },
        fields: "namedStyleType",
      },
    });
    this.index += text.length + 1;
  }

  paragraph(text: string, bold = false) {
    if (!text) return;
    this.requests.push({
      insertText: {
        location: { index: this.index },
        text: text + "\n",
      },
    });
    if (bold) {
      this.requests.push({
        updateTextStyle: {
          range: {
            startIndex: this.index,
            endIndex: this.index + text.length,
          },
          textStyle: { bold: true },
          fields: "bold",
        },
      });
    }
    this.index += text.length + 1;
  }

  labelValue(label: string, value: string) {
    const text = `${label}: ${value}`;
    this.requests.push({
      insertText: {
        location: { index: this.index },
        text: text + "\n",
      },
    });
    // ラベル部分を太字
    this.requests.push({
      updateTextStyle: {
        range: {
          startIndex: this.index,
          endIndex: this.index + label.length + 1,
        },
        textStyle: { bold: true },
        fields: "bold",
      },
    });
    this.index += text.length + 1;
  }

  bullet(text: string) {
    this.requests.push({
      insertText: {
        location: { index: this.index },
        text: text + "\n",
      },
    });
    this.requests.push({
      createParagraphBullets: {
        range: {
          startIndex: this.index,
          endIndex: this.index + text.length + 1,
        },
        bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
      },
    });
    this.index += text.length + 1;
  }

  divider() {
    this.requests.push({
      insertText: {
        location: { index: this.index },
        text: "\n",
      },
    });
    this.index += 1;
  }
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
    const auth = getGoogleAuth();
    const docsApi = google.docs({ version: "v1", auth });
    const drive = google.drive({ version: "v3", auth });

    const diag = stored.diagnosisData;
    const result = stored.analysisResult;
    const sa = stored.selfAnalysis;
    const agent = stored.agentAnalysis;
    const plan = stored.detailedPlan;
    const name = diag.name || "名前未登録";
    const dateStr = formatDate(stored.createdAt);
    const title = `${name}_求職者情報_${dateStr}`;

    // ドキュメント作成
    const doc = await docsApi.documents.create({
      requestBody: { title },
    });
    const documentId = doc.data.documentId!;

    // コンテンツ構築
    const builder = new DocBuilder();

    // === 求職者情報 ===
    builder.heading(`${name} - 求職者情報`, 1);
    builder.labelValue("氏名", name);
    builder.labelValue("年齢層", diag.ageRange);
    builder.labelValue(
      "職種",
      diag.jobType === "その他" && diag.jobTypeOther
        ? diag.jobTypeOther
        : diag.jobType,
    );
    builder.labelValue("就業状況", diag.employmentStatus);
    builder.labelValue("気になること", diag.concerns.join("、"));
    builder.labelValue("大事にしたいこと", diag.values.join("、"));
    builder.labelValue(
      "診断日時",
      new Date(stored.createdAt).toLocaleString("ja-JP"),
    );
    builder.divider();

    // === 基本分析結果 ===
    builder.heading("基本分析結果", 1);
    for (const path of result.career_paths) {
      builder.heading(
        `${path.title}（マッチ度: ${path.match_score}点）`,
        2,
      );
      builder.labelValue(
        "年収",
        `${path.salary_range.min}〜${path.salary_range.max}${path.salary_range.unit}`,
      );
      builder.paragraph(path.description);
      builder.paragraph(`推薦理由: ${path.why_recommended}`);

      if (path.roadmap?.length > 0) {
        builder.paragraph("ロードマップ:", true);
        for (const step of path.roadmap) {
          builder.bullet(`${step.period}: ${step.action}`);
        }
      }
      if (path.pros?.length > 0) {
        builder.paragraph("メリット:", true);
        for (const p of path.pros) builder.bullet(p);
      }
      if (path.cons?.length > 0) {
        builder.paragraph("デメリット:", true);
        for (const c of path.cons) builder.bullet(c);
      }
      if (path.risks) {
        builder.labelValue("リスク", path.risks);
      }
    }

    builder.heading("スキル分析", 2);
    const skillKeys = Array.from(
      new Set([
        ...Object.keys(result.skill_analysis.current_skills),
        ...Object.keys(result.skill_analysis.target_skills),
      ]),
    );
    for (const skill of skillKeys) {
      const current = result.skill_analysis.current_skills[skill] ?? 0;
      const target = result.skill_analysis.target_skills[skill] ?? 0;
      builder.bullet(`${skill}: 現在 ${current} → 目標 ${target}`);
    }

    builder.heading("AIアドバイス", 2);
    builder.paragraph(result.overall_advice);
    builder.divider();

    // === 自己分析 ===
    if (sa) {
      builder.heading("自己分析アンケート回答", 1);

      builder.heading("強みと適性", 2);
      builder.labelValue("自然に得意なこと", sa.naturalStrengths.join("、") + (sa.naturalStrengthsOther ? `、${sa.naturalStrengthsOther}` : ""));
      builder.labelValue("褒められた経験", sa.praisedExperiences.join("、") + (sa.praisedExperiencesOther ? `、${sa.praisedExperiencesOther}` : ""));
      if (sa.strengths?.length) {
        builder.labelValue("強み", sa.strengths.join("、") + (sa.strengthsOther ? `、${sa.strengthsOther}` : ""));
      }

      builder.heading("趣味・適性", 2);
      builder.labelValue("集中できる趣味", sa.focusedHobbies.join("、") + (sa.focusedHobbiesOther ? `、${sa.focusedHobbiesOther}` : ""));
      builder.labelValue("3年以上の趣味", sa.longTermHobbies.join("、") + (sa.longTermHobbiesOther ? `、${sa.longTermHobbiesOther}` : ""));
      builder.labelValue("教えられるスキル", sa.teachableSkills.join("、") + (sa.teachableSkillsOther ? `、${sa.teachableSkillsOther}` : ""));

      builder.heading("経験・価値観", 2);
      builder.labelValue("感謝された経験", sa.appreciatedExperiences.join("、") + (sa.appreciatedExperiencesOther ? `、${sa.appreciatedExperiencesOther}` : ""));
      builder.labelValue("遭難シナリオ", sa.survivalScenario + (sa.survivalScenarioOther ? `（${sa.survivalScenarioOther}）` : ""));
      builder.labelValue("理由", sa.survivalScenarioReason);

      builder.heading("仕事の価値観", 2);
      builder.labelValue("大切にしたいこと", `1位=${sa.workValue1}, 2位=${sa.workValue2}, 3位=${sa.workValue3}`);
      builder.labelValue("働くとは", `1位=${sa.workMeaning1}, 2位=${sa.workMeaning2}, 3位=${sa.workMeaning3}`);

      builder.heading("人生設計", 2);
      builder.labelValue("結婚", sa.marriage);
      builder.labelValue("子ども", sa.children + (sa.childrenOther ? `（${sa.childrenOther}）` : ""));
      builder.labelValue("家賃", sa.rent + (sa.rentOther ? `（${sa.rentOther}）` : ""));
      builder.labelValue("一番大事なこと", sa.priority + (sa.priorityOther ? `（${sa.priorityOther}）` : ""));
      builder.labelValue("仕事一筋度", `${sa.workDedication}/5`);
      builder.labelValue("希望年収", sa.desiredIncome + (sa.desiredIncomeOther ? `（${sa.desiredIncomeOther}）` : ""));

      builder.heading("希望条件", 2);
      builder.labelValue("企業知名度", `${sa.desiredCompanyFame}/5`);
      builder.labelValue("勤務時間", sa.desiredWorkHours);
      builder.labelValue("勤務地", sa.desiredLocation);
      builder.labelValue("残業", sa.desiredOvertime);
      builder.labelValue("職種", sa.desiredJobTypes.join("、"));
      builder.labelValue("業種", sa.desiredIndustries.join("、"));
      builder.labelValue("雰囲気", sa.desiredAtmosphere);

      builder.heading("現在の状況", 2);
      builder.labelValue("年収", sa.currentIncome + (sa.currentIncomeOther ? `（${sa.currentIncomeOther}）` : ""));
      builder.labelValue("企業知名度", `${sa.currentCompanyFame}/5`);
      builder.labelValue("勤務地", sa.currentLocation);
      builder.labelValue("残業", sa.currentOvertime);
      builder.labelValue("職種", sa.currentJobType);
      builder.labelValue("業種", sa.currentIndustry);
      builder.labelValue("雰囲気", sa.currentAtmosphere);

      builder.heading("転職改善ポイント", 2);
      builder.bullet(`1位: ${sa.improvement1}${sa.improvement1Other ? `（${sa.improvement1Other}）` : ""}`);
      builder.bullet(`2位: ${sa.improvement2}${sa.improvement2Other ? `（${sa.improvement2Other}）` : ""}`);
      builder.bullet(`3位: ${sa.improvement3}${sa.improvement3Other ? `（${sa.improvement3Other}）` : ""}`);
      builder.bullet(`4位: ${sa.improvement4}${sa.improvement4Other ? `（${sa.improvement4Other}）` : ""}`);
      builder.bullet(`5位: ${sa.improvement5}${sa.improvement5Other ? `（${sa.improvement5Other}）` : ""}`);
      builder.divider();
    }

    // === エージェント分析 ===
    if (agent) {
      builder.heading("エージェント向け詳細分析", 1);
      builder.heading("エージェント所見", 2);
      builder.paragraph(agent.agent_summary);

      for (const p of agent.detailed_career_plans) {
        builder.heading(`${p.title}（マッチ度: ${p.match_score}点）`, 2);
        builder.labelValue("年収", `${p.salary_range.min}〜${p.salary_range.max}${p.salary_range.unit}`);
        builder.labelValue("難易度", p.transition_difficulty);
        builder.paragraph(p.detailed_description);
        builder.labelValue("推薦理由", p.why_recommended);
      }

      builder.heading("スキルギャップ分析", 2);
      for (const sg of agent.skill_gap_analysis) {
        builder.bullet(`${sg.skill_name}: ${sg.current_level}→${sg.target_level} (${sg.priority}) - ${sg.improvement_method}`);
      }

      builder.heading("市場動向", 2);
      builder.labelValue("業界トレンド", agent.market_insights.industry_trend);
      builder.labelValue("需要", agent.market_insights.demand_level);
      builder.labelValue("競争", agent.market_insights.competition_level);
      builder.labelValue("見通し", agent.market_insights.future_outlook);

      builder.heading("年収交渉", 2);
      builder.labelValue("市場レンジ", `${agent.salary_negotiation.current_market_range.min}〜${agent.salary_negotiation.current_market_range.max}万円`);
      builder.paragraph("交渉ポイント:", true);
      for (const p of agent.salary_negotiation.negotiation_points) {
        builder.bullet(p);
      }
      builder.divider();
    }

    // === 詳細プラン ===
    if (plan) {
      builder.heading("詳細キャリア・人生プラン", 1);

      builder.heading("パーソナルプロフィール", 2);
      builder.paragraph(plan.personalProfile.summary);
      builder.labelValue("コア強み", plan.personalProfile.coreStrengths.join("、"));
      builder.labelValue("パーソナリティ", plan.personalProfile.personalityType);
      builder.labelValue("適した働き方", plan.personalProfile.workStyle);

      builder.heading("キャリア戦略", 2);
      for (const key of ["shortTerm", "midTerm", "longTerm"] as const) {
        const s = plan.careerStrategy[key];
        const labels = { shortTerm: "短期", midTerm: "中期", longTerm: "長期" };
        builder.paragraph(`【${labels[key]}】${s.period}`, true);
        builder.paragraph("目標:", true);
        for (const g of s.goals) builder.bullet(g);
        builder.paragraph("アクション:", true);
        for (const a of s.actions) builder.bullet(a);
      }

      builder.heading("ライフプラン", 2);
      builder.labelValue("経済面", plan.lifePlan.financialPlan);
      builder.labelValue("家庭", plan.lifePlan.familyPlan);
      builder.labelValue("ライフスタイル", plan.lifePlan.lifestyleAdvice);
      builder.labelValue("バランス", plan.lifePlan.balanceStrategy);

      builder.heading("ギャップ分析", 2);
      for (const g of plan.gapAnalysis.currentVsDesired) {
        builder.paragraph(`${g.area}`, true);
        builder.labelValue("現在", g.current);
        builder.labelValue("希望", g.desired);
        builder.labelValue("アクション", g.action);
      }

      builder.heading("総合所見", 2);
      builder.paragraph(plan.overallSummary);
    }

    // リクエスト送信
    if (builder.requests.length > 0) {
      await docsApi.documents.batchUpdate({
        documentId,
        requestBody: { requests: builder.requests },
      });
    }

    // 共有設定
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const url = `https://docs.google.com/document/d/${documentId}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Google Docs export error:", err);
    return NextResponse.json(
      { error: "ドキュメントの作成に失敗しました。" },
      { status: 500 },
    );
  }
}
