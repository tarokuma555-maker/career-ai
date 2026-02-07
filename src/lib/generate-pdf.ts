import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { AnalysisResult } from "./types";

// ---------- HTML構築ヘルパー ----------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPdfHtml(
  result: AnalysisResult,
  diagnosisData?: Record<string, unknown>
): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  const userInfo = diagnosisData
    ? [
        diagnosisData.ageRange,
        diagnosisData.jobType === "その他"
          ? diagnosisData.jobTypeOther
          : diagnosisData.jobType,
        diagnosisData.industry,
        diagnosisData.experienceYears,
      ]
        .filter(Boolean)
        .join(" / ")
    : "";

  const careerPathsHtml = result.career_paths
    .map(
      (path, i) => `
    <div style="margin-bottom:28px;page-break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:52px;height:52px;border-radius:50%;border:3px solid #2563eb;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#2563eb;flex-shrink:0;">
          ${path.match_score}
        </div>
        <div>
          <div style="font-size:17px;font-weight:700;color:#111;">${escapeHtml(path.title)}</div>
          <div style="font-size:12px;color:#666;">年収 ${path.salary_range.min}〜${path.salary_range.max}${path.salary_range.unit}</div>
        </div>
      </div>
      <p style="font-size:13px;color:#444;margin:0 0 8px 0;">${escapeHtml(path.description)}</p>

      <div style="background:#eff6ff;border-radius:6px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-size:12px;font-weight:600;color:#2563eb;margin-bottom:4px;">推薦理由</div>
        <div style="font-size:12px;color:#333;">${escapeHtml(path.why_recommended)}</div>
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px;">ロードマップ</div>
        ${path.roadmap
          .map(
            (r) => `
          <div style="display:flex;gap:8px;margin-bottom:5px;font-size:12px;">
            <div style="width:18px;height:18px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0;">${r.step}</div>
            <div><span style="font-weight:600;color:#2563eb;">${escapeHtml(r.period)}</span>　${escapeHtml(r.action)}</div>
          </div>`
          )
          .join("")}
      </div>

      <div style="margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;">必要スキル：</span>
        ${path.required_skills
          .map(
            (s) =>
              `<span style="display:inline-block;background:#e2e8f0;border-radius:4px;padding:2px 8px;font-size:11px;margin:2px 3px;">${escapeHtml(s)}</span>`
          )
          .join("")}
      </div>

      <div style="display:flex;gap:16px;font-size:12px;margin-bottom:6px;">
        <div style="flex:1;">
          <div style="font-weight:600;color:#16a34a;margin-bottom:3px;">メリット</div>
          <ul style="margin:0;padding-left:16px;color:#444;">${path.pros.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
        </div>
        <div style="flex:1;">
          <div style="font-weight:600;color:#ea580c;margin-bottom:3px;">デメリット</div>
          <ul style="margin:0;padding-left:16px;color:#444;">${path.cons.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
        </div>
      </div>

      <div style="font-size:12px;">
        <span style="font-weight:600;color:#ca8a04;">リスク：</span>
        <span style="color:#444;">${escapeHtml(path.risks)}</span>
      </div>

      ${i < result.career_paths.length - 1 ? '<hr style="border:none;border-top:1px solid #e2e8f0;margin-top:16px;">' : ""}
    </div>`
    )
    .join("");

  // スキル分析テーブル
  const allSkills = Array.from(
    new Set([
      ...Object.keys(result.skill_analysis.current_skills),
      ...Object.keys(result.skill_analysis.target_skills),
    ])
  );
  const skillRowsHtml = allSkills
    .map((skill) => {
      const current = result.skill_analysis.current_skills[skill] ?? 0;
      const target = result.skill_analysis.target_skills[skill] ?? 0;
      const gap = target - current;
      return `
        <tr>
          <td style="padding:4px 8px;font-size:12px;">${escapeHtml(skill)}</td>
          <td style="padding:4px 8px;font-size:12px;text-align:center;">${current}/10</td>
          <td style="padding:4px 8px;font-size:12px;text-align:center;">
            <div style="background:#e2e8f0;border-radius:4px;height:8px;position:relative;">
              <div style="background:#2563eb;border-radius:4px;height:8px;width:${current * 10}%;"></div>
            </div>
          </td>
          <td style="padding:4px 8px;font-size:12px;text-align:center;">${target}/10</td>
          <td style="padding:4px 8px;font-size:12px;text-align:center;color:${gap > 0 ? "#ea580c" : "#16a34a"};">${gap > 0 ? "+" + gap : gap === 0 ? "−" : gap}</td>
        </tr>`;
    })
    .join("");

  return `
<div id="pdf-root" style="width:800px;font-family:'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif;color:#111;background:#fff;padding:40px;">
  <!-- ヘッダー -->
  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:24px;font-weight:700;color:#111;margin-bottom:4px;">キャリアAI - あなたのキャリアプラン</div>
    <div style="font-size:13px;color:#666;">${dateStr} 作成${userInfo ? `　|　${escapeHtml(userInfo)}` : ""}</div>
  </div>

  <hr style="border:none;border-top:2px solid #2563eb;margin-bottom:28px;">

  <!-- キャリアパス -->
  <div style="font-size:18px;font-weight:700;margin-bottom:16px;">おすすめのキャリアパス</div>
  ${careerPathsHtml}

  <!-- スキル分析 -->
  <div style="margin-top:32px;page-break-inside:avoid;">
    <div style="font-size:18px;font-weight:700;margin-bottom:12px;">スキルギャップ分析</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:6px 8px;font-size:12px;text-align:left;border-bottom:1px solid #e2e8f0;">スキル</th>
          <th style="padding:6px 8px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">現在</th>
          <th style="padding:6px 8px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;width:180px;">レベル</th>
          <th style="padding:6px 8px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">目標</th>
          <th style="padding:6px 8px;font-size:12px;text-align:center;border-bottom:1px solid #e2e8f0;">Gap</th>
        </tr>
      </thead>
      <tbody>
        ${skillRowsHtml}
      </tbody>
    </table>
  </div>

  <!-- 総合アドバイス -->
  <div style="margin-top:32px;page-break-inside:avoid;">
    <div style="font-size:18px;font-weight:700;margin-bottom:8px;">総合アドバイス</div>
    <div style="background:#f0fdf4;border-radius:8px;padding:16px;font-size:13px;line-height:1.8;color:#333;">
      ${escapeHtml(result.overall_advice)}
    </div>
  </div>

  <!-- フッター -->
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#999;">
    ※ このレポートはAIにより生成されたものです。最終判断はご自身でお願いします。
  </div>
</div>`;
}

// ---------- PDF生成 ----------

export async function generatePdf(
  result: AnalysisResult,
  diagnosisData?: Record<string, unknown>
): Promise<void> {
  // オフスクリーン要素を作成
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.innerHTML = buildPdfHtml(result, diagnosisData);
  document.body.appendChild(container);

  const root = container.querySelector("#pdf-root") as HTMLElement;

  try {
    const canvas = await html2canvas(root, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF("p", "mm", "a4");
    let remainingHeight = imgHeight;
    let position = 0;

    while (remainingHeight > 0) {
      if (position > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        -position,
        imgWidth,
        imgHeight
      );

      remainingHeight -= pageHeight;
      position += pageHeight;
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    pdf.save(`キャリアプラン_${y}${m}${d}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
