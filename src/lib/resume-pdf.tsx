import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import type { GeneratedResumeData, GeneratedCVData } from "./resume-types";

// ---------- フォント登録 ----------
Font.register({
  family: "NotoSansJP",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-400-normal.woff",
      fontWeight: 400,
    },
    {
      src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-700-normal.woff",
      fontWeight: 700,
    },
  ],
});

// ---------- スタイル ----------
const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 40, color: "#1a1a1a" },
  title: { fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#666", textAlign: "center", marginBottom: 16 },
  divider: { borderBottom: "2px solid #2563eb", marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#2563eb", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #e2e8f0" },
  section: { marginBottom: 14 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 80, fontWeight: 700, fontSize: 9, color: "#444" },
  value: { flex: 1, fontSize: 9 },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #e2e8f0", paddingVertical: 3 },
  tableDate: { width: 75, fontSize: 9, color: "#444" },
  tableDetail: { flex: 1, fontSize: 9 },
  body: { fontSize: 9, lineHeight: 1.6, color: "#333" },
  badge: { backgroundColor: "#e2e8f0", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, fontSize: 8, marginRight: 4, marginBottom: 4 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 7, color: "#999", borderTop: "1px solid #e2e8f0", paddingTop: 8 },
  workEntry: { marginBottom: 12 },
  companyName: { fontSize: 10, fontWeight: 700 },
  period: { fontSize: 8, color: "#666" },
  subLabel: { fontSize: 8, fontWeight: 700, color: "#2563eb", marginBottom: 2 },
  bullet: { fontSize: 9, marginBottom: 2, paddingLeft: 8 },
});

// ---------- 履歴書 PDF ----------
function ResumePdf({ data }: { data: GeneratedResumeData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>履 歴 書</Text>
        <Text style={s.subtitle}>{data.personalInfo.birthdate ? `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}日 現在` : ""}</Text>
        <View style={s.divider} />

        <View style={s.section}>
          <Text style={s.sectionTitle}>基本情報</Text>
          <View style={s.row}><Text style={s.label}>氏名</Text><Text style={s.value}>{data.personalInfo.name}（{data.personalInfo.nameKana}）</Text></View>
          <View style={s.row}><Text style={s.label}>生年月日</Text><Text style={s.value}>{data.personalInfo.birthdate}（{data.personalInfo.age}歳）</Text></View>
          {data.personalInfo.gender && <View style={s.row}><Text style={s.label}>性別</Text><Text style={s.value}>{data.personalInfo.gender}</Text></View>}
          <View style={s.row}><Text style={s.label}>住所</Text><Text style={s.value}>{data.personalInfo.address}</Text></View>
          <View style={s.row}><Text style={s.label}>電話</Text><Text style={s.value}>{data.personalInfo.phone}</Text></View>
          <View style={s.row}><Text style={s.label}>メール</Text><Text style={s.value}>{data.personalInfo.email}</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>学歴</Text>
          {data.education.map((e, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.tableDate}>{e.yearMonth}</Text>
              <Text style={s.tableDetail}>{e.detail}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>職歴</Text>
          {data.workHistory.map((w, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.tableDate}>{w.yearMonth}</Text>
              <Text style={s.tableDetail}>{w.detail}</Text>
            </View>
          ))}
        </View>

        {data.qualifications.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>資格・免許</Text>
            {data.qualifications.map((q, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={s.tableDate}>{q.yearMonth}</Text>
                <Text style={s.tableDetail}>{q.detail}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>自己PR</Text>
          <Text style={s.body}>{data.selfPR}</Text>
        </View>

        <Text style={s.footer}>Career AI で自動生成されました</Text>
      </Page>
    </Document>
  );
}

// ---------- 職務経歴書 PDF ----------
function CVPdf({ data }: { data: GeneratedCVData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>職 務 経 歴 書</Text>
        <Text style={s.subtitle}>{new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日 現在</Text>
        <View style={s.divider} />

        {data.summary && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>職務要約</Text>
            <Text style={s.body}>{data.summary}</Text>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>職務経歴</Text>
          {data.workHistory.map((w, i) => (
            <View key={i} style={s.workEntry}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={s.companyName}>{w.company}</Text>
                <Text style={s.period}>{w.period}</Text>
              </View>
              <Text style={{ fontSize: 8, color: "#666", marginBottom: 2 }}>
                {w.department}{w.position ? ` / ${w.position}` : ""} ({w.employmentType})
              </Text>
              {w.companyDescription && <Text style={{ fontSize: 8, color: "#888", marginBottom: 4 }}>事業内容: {w.companyDescription}</Text>}
              <Text style={s.body}>{w.responsibilities}</Text>
              {w.achievements.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={s.subLabel}>実績・成果</Text>
                  {w.achievements.map((a, j) => <Text key={j} style={s.bullet}>・{a}</Text>)}
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>スキル</Text>
          {data.skills.technical.length > 0 && (
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 2 }}>技術スキル</Text>
              <View style={s.badgeRow}>{data.skills.technical.map(sk => <Text key={sk} style={s.badge}>{sk}</Text>)}</View>
            </View>
          )}
          {data.skills.business.length > 0 && (
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 2 }}>ビジネススキル</Text>
              <View style={s.badgeRow}>{data.skills.business.map(sk => <Text key={sk} style={s.badge}>{sk}</Text>)}</View>
            </View>
          )}
          {data.skills.languages.length > 0 && (
            <View style={s.row}><Text style={s.label}>語学</Text><Text style={s.value}>{data.skills.languages.join("、")}</Text></View>
          )}
        </View>

        {data.qualifications.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>資格</Text>
            {data.qualifications.map((q, i) => <Text key={i} style={s.bullet}>・{q}</Text>)}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>自己PR</Text>
          <Text style={s.body}>{data.selfPR}</Text>
        </View>

        {data.motivation && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>志望動機</Text>
            <Text style={s.body}>{data.motivation}</Text>
          </View>
        )}

        <Text style={{ textAlign: "right", fontSize: 9, marginTop: 16 }}>以上</Text>
        <Text style={s.footer}>Career AI で自動生成されました</Text>
      </Page>
    </Document>
  );
}

// ---------- エクスポート ----------
export function ResumeDocument({ data }: { data: GeneratedResumeData }) {
  return <ResumePdf data={data} />;
}

export function CVDocument({ data }: { data: GeneratedCVData }) {
  return <CVPdf data={data} />;
}
