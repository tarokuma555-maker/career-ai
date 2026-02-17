import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { kv } from "@vercel/kv";
import type { StoredDiagnosis } from "@/lib/agent-types";
import { uploadToGoogleDrive } from "@/lib/google-drive-upload";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- スタイル定義 ----------

const BLUE = "FF4472C4";
const LIGHT_BLUE = "FFD6E4F0";
const LIGHTER_BLUE = "FFEBF1FA";
const WHITE = "FFFFFFFF";
const BORDER_COLOR = "FFB0B0B0";

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
  left: { style: "thin", color: { argb: BORDER_COLOR } },
  right: { style: "thin", color: { argb: BORDER_COLOR } },
};

/** セクションタイトル（結合行用） */
function addSectionTitle(ws: ExcelJS.Worksheet, text: string, colCount: number) {
  const row = ws.addRow([text]);
  row.getCell(1).style = {
    font: { bold: true, color: { argb: WHITE }, size: 12 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } },
    alignment: { vertical: "middle" },
  };
  if (colCount > 1) {
    ws.mergeCells(row.number, 1, row.number, colCount);
  }
  row.height = 28;
}

/** テーブルヘッダー行 */
function addTableHeader(ws: ExcelJS.Worksheet, headers: string[]) {
  const row = ws.addRow(headers);
  row.eachCell((c) => {
    c.style = {
      font: { bold: true, color: { argb: "FF333333" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } },
      border: thinBorder,
      alignment: { vertical: "middle", wrapText: true },
    };
  });
  row.height = 22;
  return row;
}

/** データ行を追加（交互色） */
function addDataRow(
  ws: ExcelJS.Worksheet,
  values: (string | number)[],
  index: number,
  labelBold = false,
) {
  const row = ws.addRow(values);
  const bg = index % 2 === 0 ? WHITE : LIGHTER_BLUE;
  row.eachCell((c, colNum) => {
    c.style = {
      font: { bold: labelBold && colNum === 1 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: bg } },
      border: thinBorder,
      alignment: { vertical: "top", wrapText: true },
    };
  });
  return row;
}

/** ラベル:値の行を追加（2列） */
function addLabelValueRows(
  ws: ExcelJS.Worksheet,
  rows: [string, string][],
  startIndex = 0,
) {
  rows.forEach(([label, val], i) => {
    addDataRow(ws, [label, val], startIndex + i, true);
  });
}

/** 列幅を自動調整（日本語文字を2幅として計算） */
function autoWidth(ws: ExcelJS.Worksheet, minWidths?: number[]) {
  ws.columns.forEach((col, i) => {
    let max = minWidths?.[i] ?? 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const text = String(cell.value ?? "");
      // 日本語文字は2倍幅で計算
      let len = 0;
      for (const ch of text) {
        len += ch.charCodeAt(0) > 0xff ? 2 : 1;
      }
      if (len > max) max = len;
    });
    col.width = Math.min(max + 3, 50);
  });
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

    const wb = new ExcelJS.Workbook();
    wb.creator = "Career AI";
    wb.created = new Date();

    // ========== 1. 求職者情報シート ==========
    const wsInfo = wb.addWorksheet("求職者情報");
    addSectionTitle(wsInfo, `${name} - 求職者基本情報`, 2);
    wsInfo.addRow([]);
    addTableHeader(wsInfo, ["項目", "内容"]);
    addLabelValueRows(wsInfo, [
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
    ]);
    autoWidth(wsInfo, [18, 40]);

    // ========== 2. 基本分析シート ==========
    const wsAnalysis = wb.addWorksheet("基本分析");

    // キャリアパス
    addSectionTitle(wsAnalysis, "キャリアパス提案", 6);
    wsAnalysis.addRow([]);
    addTableHeader(wsAnalysis, [
      "キャリアパス",
      "マッチ度",
      "年収(最低)",
      "年収(最高)",
      "説明",
      "推薦理由",
    ]);
    result.career_paths.forEach((path, i) => {
      const row = addDataRow(
        wsAnalysis,
        [
          path.title,
          path.match_score,
          path.salary_range.min,
          path.salary_range.max,
          path.description,
          path.why_recommended,
        ],
        i,
      );
      // マッチ度セルに色付け
      const scoreCell = row.getCell(2);
      const score = path.match_score;
      if (score >= 80) {
        scoreCell.font = { bold: true, color: { argb: "FF217346" } };
      } else if (score >= 60) {
        scoreCell.font = { bold: true, color: { argb: "FFBF8F00" } };
      }
    });

    wsAnalysis.addRow([]);
    wsAnalysis.addRow([]);

    // スキル分析
    addSectionTitle(wsAnalysis, "スキル分析", 3);
    wsAnalysis.addRow([]);
    addTableHeader(wsAnalysis, ["スキル", "現在レベル", "目標レベル"]);
    const skillKeys = Array.from(
      new Set([
        ...Object.keys(result.skill_analysis.current_skills),
        ...Object.keys(result.skill_analysis.target_skills),
      ]),
    );
    skillKeys.forEach((skill, i) => {
      addDataRow(
        wsAnalysis,
        [
          skill,
          result.skill_analysis.current_skills[skill] ?? 0,
          result.skill_analysis.target_skills[skill] ?? 0,
        ],
        i,
      );
    });

    wsAnalysis.addRow([]);
    wsAnalysis.addRow([]);

    // AIアドバイス
    addSectionTitle(wsAnalysis, "AIアドバイス", 6);
    wsAnalysis.addRow([]);
    const adviceRow = wsAnalysis.addRow([result.overall_advice]);
    adviceRow.getCell(1).alignment = { wrapText: true };
    ws_mergeTo(wsAnalysis, adviceRow.number, 6);
    adviceRow.height = 60;

    autoWidth(wsAnalysis, [18, 10, 12, 12, 35, 35]);

    // ========== 3. 自己分析シート ==========
    const wsSelf = wb.addWorksheet("自己分析");
    if (sa) {
      let idx = 0;
      const section = (title: string, rows: [string, string][]) => {
        addSectionTitle(wsSelf, title, 2);
        wsSelf.addRow([]);
        addTableHeader(wsSelf, ["項目", "回答"]);
        addLabelValueRows(wsSelf, rows, idx);
        idx += rows.length;
        wsSelf.addRow([]);
      };

      section("基本情報・強み", [
        ["氏名", sa.name],
        ["自然に得意なこと", sa.naturalStrengths.join("、") + (sa.naturalStrengthsOther ? `、${sa.naturalStrengthsOther}` : "")],
        ["褒められた経験", sa.praisedExperiences.join("、") + (sa.praisedExperiencesOther ? `、${sa.praisedExperiencesOther}` : "")],
        ["強み", (sa.strengths?.join("、") || "") + (sa.strengthsOther ? `、${sa.strengthsOther}` : "")],
      ]);

      section("趣味・スキル", [
        ["集中できる趣味", sa.focusedHobbies.join("、") + (sa.focusedHobbiesOther ? `、${sa.focusedHobbiesOther}` : "")],
        ["3年以上の趣味", sa.longTermHobbies.join("、") + (sa.longTermHobbiesOther ? `、${sa.longTermHobbiesOther}` : "")],
        ["教えられるスキル", sa.teachableSkills.join("、") + (sa.teachableSkillsOther ? `、${sa.teachableSkillsOther}` : "")],
        ["感謝された経験", sa.appreciatedExperiences.join("、") + (sa.appreciatedExperiencesOther ? `、${sa.appreciatedExperiencesOther}` : "")],
      ]);

      section("価値観・人生設計", [
        ["遭難シナリオ", sa.survivalScenario + (sa.survivalScenarioOther ? `（${sa.survivalScenarioOther}）` : "")],
        ["遭難シナリオの理由", sa.survivalScenarioReason],
        ["大切にしたいこと", `1位=${sa.workValue1}, 2位=${sa.workValue2}, 3位=${sa.workValue3}`],
        ["働くとは", `1位=${sa.workMeaning1}, 2位=${sa.workMeaning2}, 3位=${sa.workMeaning3}`],
        ["結婚", sa.marriage],
        ["子ども", sa.children + (sa.childrenOther ? `（${sa.childrenOther}）` : "")],
        ["家賃", sa.rent + (sa.rentOther ? `（${sa.rentOther}）` : "")],
        ["一番大事なこと", sa.priority + (sa.priorityOther ? `（${sa.priorityOther}）` : "")],
        ["仕事一筋度", `${sa.workDedication}/5`],
      ]);

      section("希望条件", [
        ["希望年収", sa.desiredIncome + (sa.desiredIncomeOther ? `（${sa.desiredIncomeOther}）` : "")],
        ["希望企業知名度", `${sa.desiredCompanyFame}/5`],
        ["希望スキル", sa.desiredSkills.join("、") + (sa.desiredSkillsOther ? `、${sa.desiredSkillsOther}` : "")],
        ["希望勤務時間", sa.desiredWorkHours],
        ["希望勤務地", sa.desiredLocation],
        ["希望残業", sa.desiredOvertime],
        ["希望職種", sa.desiredJobTypes.join("、")],
        ["希望業種", sa.desiredIndustries.join("、")],
        ["希望雰囲気", sa.desiredAtmosphere],
      ]);

      section("現在の状況", [
        ["現在の年収", sa.currentIncome + (sa.currentIncomeOther ? `（${sa.currentIncomeOther}）` : "")],
        ["現在の企業知名度", `${sa.currentCompanyFame}/5`],
        ["現在のスキル", sa.currentSkills.join("、") + (sa.currentSkillsOther ? `、${sa.currentSkillsOther}` : "")],
        ["現在の勤務時間融通", `${sa.currentWorkHoursFlexibility}/5`],
        ["現在の勤務地", sa.currentLocation],
        ["現在の残業", sa.currentOvertime],
        ["現在の職種", sa.currentJobType],
        ["現在の業種", sa.currentIndustry],
        ["現在の雰囲気", sa.currentAtmosphere],
      ]);

      section("転職で改善したいこと", [
        ["改善1位", sa.improvement1],
        ["改善2位", sa.improvement2],
        ["改善3位", sa.improvement3],
        ["改善4位", sa.improvement4],
        ["改善5位", sa.improvement5],
      ]);
    } else {
      addSectionTitle(wsSelf, "自己分析", 2);
      wsSelf.addRow(["", "未回答"]);
    }
    autoWidth(wsSelf, [20, 45]);

    // ========== 4. エージェント分析シート ==========
    const wsAgent = wb.addWorksheet("エージェント分析");
    if (agent) {
      // 所見
      addSectionTitle(wsAgent, "エージェント所見", 5);
      wsAgent.addRow([]);
      const summaryRow = wsAgent.addRow([agent.agent_summary]);
      summaryRow.getCell(1).alignment = { wrapText: true };
      ws_mergeTo(wsAgent, summaryRow.number, 5);
      summaryRow.height = 60;
      wsAgent.addRow([]);

      // キャリアプラン
      addSectionTitle(wsAgent, "キャリアプラン提案", 5);
      wsAgent.addRow([]);
      addTableHeader(wsAgent, [
        "キャリアプラン",
        "マッチ度",
        "年収範囲",
        "難易度",
        "推薦理由",
      ]);
      agent.detailed_career_plans.forEach((p, i) => {
        addDataRow(
          wsAgent,
          [
            p.title,
            p.match_score,
            `${p.salary_range.min}〜${p.salary_range.max}${p.salary_range.unit}`,
            p.transition_difficulty,
            p.why_recommended,
          ],
          i,
        );
      });
      wsAgent.addRow([]);

      // スキルギャップ
      addSectionTitle(wsAgent, "スキルギャップ分析", 6);
      wsAgent.addRow([]);
      addTableHeader(wsAgent, [
        "スキル",
        "現在",
        "目標",
        "ギャップ",
        "優先度",
        "改善方法",
      ]);
      agent.skill_gap_analysis.forEach((sg, i) => {
        addDataRow(
          wsAgent,
          [
            sg.skill_name,
            sg.current_level,
            sg.target_level,
            sg.gap,
            sg.priority,
            sg.improvement_method,
          ],
          i,
        );
      });
      wsAgent.addRow([]);

      // 市場動向
      addSectionTitle(wsAgent, "市場動向", 2);
      wsAgent.addRow([]);
      addTableHeader(wsAgent, ["項目", "内容"]);
      addLabelValueRows(wsAgent, [
        ["業界トレンド", agent.market_insights.industry_trend],
        ["需要", agent.market_insights.demand_level],
        ["競争", agent.market_insights.competition_level],
        ["見通し", agent.market_insights.future_outlook],
      ]);
      wsAgent.addRow([]);

      // 年収交渉
      addSectionTitle(wsAgent, "年収交渉アドバイス", 2);
      wsAgent.addRow([]);
      addTableHeader(wsAgent, ["項目", "内容"]);
      addLabelValueRows(wsAgent, [
        [
          "市場レンジ",
          `${agent.salary_negotiation.current_market_range.min}〜${agent.salary_negotiation.current_market_range.max}万円`,
        ],
        ["交渉ポイント", agent.salary_negotiation.negotiation_points.join("\n")],
      ]);
    } else {
      addSectionTitle(wsAgent, "エージェント分析", 2);
      wsAgent.addRow(["", "未生成"]);
    }
    autoWidth(wsAgent, [18, 10, 10, 10, 10, 35]);

    // ========== 5. 詳細プランシート ==========
    const wsPlan = wb.addWorksheet("詳細プラン");
    if (plan) {
      // プロフィール
      addSectionTitle(wsPlan, "パーソナルプロフィール", 2);
      wsPlan.addRow([]);
      const profileRow = wsPlan.addRow([plan.personalProfile.summary]);
      profileRow.getCell(1).alignment = { wrapText: true };
      ws_mergeTo(wsPlan, profileRow.number, 2);
      profileRow.height = 50;
      wsPlan.addRow([]);
      addTableHeader(wsPlan, ["項目", "内容"]);
      addLabelValueRows(wsPlan, [
        ["コア強み", plan.personalProfile.coreStrengths.join("、")],
        ["パーソナリティ", plan.personalProfile.personalityType],
        ["適した働き方", plan.personalProfile.workStyle],
      ]);
      wsPlan.addRow([]);

      // キャリア戦略
      addSectionTitle(wsPlan, "キャリア戦略", 2);
      wsPlan.addRow([]);
      for (const key of ["shortTerm", "midTerm", "longTerm"] as const) {
        const s = plan.careerStrategy[key];
        const labels = { shortTerm: "短期", midTerm: "中期", longTerm: "長期" };
        // サブセクション
        const subRow = wsPlan.addRow([`${labels[key]}（${s.period}）`]);
        subRow.getCell(1).style = {
          font: { bold: true, color: { argb: WHITE } },
          fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B9BD5" } },
        };
        ws_mergeTo(wsPlan, subRow.number, 2);
        addTableHeader(wsPlan, ["項目", "内容"]);
        addLabelValueRows(wsPlan, [
          ["目標", s.goals.join("\n")],
          ["アクション", s.actions.join("\n")],
        ]);
        wsPlan.addRow([]);
      }

      // ライフプラン
      addSectionTitle(wsPlan, "ライフプラン", 2);
      wsPlan.addRow([]);
      addTableHeader(wsPlan, ["項目", "内容"]);
      addLabelValueRows(wsPlan, [
        ["経済面", plan.lifePlan.financialPlan],
        ["家庭", plan.lifePlan.familyPlan],
        ["ライフスタイル", plan.lifePlan.lifestyleAdvice],
        ["バランス", plan.lifePlan.balanceStrategy],
      ]);
      wsPlan.addRow([]);

      // ギャップ分析
      addSectionTitle(wsPlan, "ギャップ分析", 4);
      wsPlan.addRow([]);
      addTableHeader(wsPlan, ["分野", "現在", "希望", "アクション"]);
      plan.gapAnalysis.currentVsDesired.forEach((g, i) => {
        addDataRow(wsPlan, [g.area, g.current, g.desired, g.action], i);
      });
      wsPlan.addRow([]);

      // 推奨職種
      addSectionTitle(wsPlan, "推奨職種", 4);
      wsPlan.addRow([]);
      addTableHeader(wsPlan, ["職種", "理由", "年収", "適合度"]);
      plan.detailedRecommendations.jobRecommendations.forEach((j, i) => {
        addDataRow(wsPlan, [j.title, j.reason, j.salary, j.fit], i);
      });
      wsPlan.addRow([]);

      // 総合所見
      addSectionTitle(wsPlan, "総合所見", 4);
      wsPlan.addRow([]);
      const overallRow = wsPlan.addRow([plan.overallSummary]);
      overallRow.getCell(1).alignment = { wrapText: true };
      ws_mergeTo(wsPlan, overallRow.number, 4);
      overallRow.height = 80;
    } else {
      addSectionTitle(wsPlan, "詳細プラン", 2);
      wsPlan.addRow(["", "未生成"]);
    }
    autoWidth(wsPlan, [18, 40, 18, 30]);

    // ========== バッファに書き出し ==========
    const buffer = await wb.xlsx.writeBuffer();
    const uint8 = new Uint8Array(buffer);
    const fileName = `${name}_求職者情報_${dateStr}.xlsx`;

    const url = await uploadToGoogleDrive(
      uint8,
      fileName,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.google-apps.spreadsheet",
    );

    return NextResponse.json({ url, type: "google_sheets" });
  } catch (err) {
    console.error("Excel export error:", err);
    return NextResponse.json(
      { error: "Excelファイルの作成に失敗しました。" },
      { status: 500 },
    );
  }
}

/** セルを結合するヘルパー */
function ws_mergeTo(ws: ExcelJS.Worksheet, rowNum: number, colCount: number) {
  if (colCount > 1) {
    ws.mergeCells(rowNum, 1, rowNum, colCount);
  }
}
