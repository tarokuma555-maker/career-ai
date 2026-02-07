import { z } from "zod";

export const AGE_RANGES = [
  "20代前半",
  "20代後半",
  "30代前半",
  "30代後半",
  "40代以上",
] as const;

export const EDUCATION_LEVELS = [
  "高校卒",
  "専門学校卒",
  "大学卒",
  "大学院卒",
] as const;

export const EMPLOYMENT_STATUSES = [
  "正社員",
  "契約社員",
  "フリーランス",
  "パート・アルバイト",
  "学生",
  "離職中",
] as const;

export const JOB_TYPES = [
  "営業",
  "エンジニア",
  "デザイナー",
  "マーケティング",
  "事務",
  "人事",
  "経理・財務",
  "企画",
  "管理職",
  "その他",
] as const;

export const INDUSTRIES = [
  "IT・通信",
  "金融・保険",
  "メーカー",
  "サービス",
  "医療・福祉",
  "教育",
  "不動産",
  "コンサル",
  "官公庁",
  "その他",
] as const;

export const EXPERIENCE_YEARS = [
  "1年未満",
  "1〜3年",
  "3〜5年",
  "5〜10年",
  "10年以上",
] as const;

export const SKILL_OPTIONS = [
  "コミュニケーション",
  "リーダーシップ",
  "データ分析",
  "プログラミング",
  "デザイン",
  "英語",
  "マネジメント",
  "営業力",
  "企画力",
  "ライティング",
] as const;

export const CAREER_CONCERNS = [
  "転職したい",
  "副業を始めたい",
  "キャリアアップしたい",
  "独立・起業したい",
  "方向性がわからない",
] as const;

export const VALUES = [
  "年収アップ",
  "ワークライフバランス",
  "やりがい",
  "成長機会",
  "安定性",
  "リモートワーク",
] as const;

export const URGENCY_OPTIONS = [
  "すぐにでも",
  "半年以内",
  "1年以内",
  "まだ情報収集中",
] as const;

// Step 1
export const step1Schema = z.object({
  ageRange: z.string().min(1, "年齢層を選択してください"),
  education: z.string().min(1, "最終学歴を選択してください"),
  employmentStatus: z.string().min(1, "就業状況を選択してください"),
});

// Step 2
export const step2Schema = z
  .object({
    jobType: z.string().min(1, "職種を選択してください"),
    jobTypeOther: z.string().optional(),
    industry: z.string().min(1, "業界を選択してください"),
    experienceYears: z.string().min(1, "経験年数を選択してください"),
    skills: z.array(z.string()).min(1, "スキルを1つ以上選択してください"),
    customSkill: z.string().optional(),
    certifications: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.jobType === "その他") {
        return !!data.jobTypeOther && data.jobTypeOther.trim().length > 0;
      }
      return true;
    },
    { message: "職種を入力してください", path: ["jobTypeOther"] }
  );

// Step 3
export const step3Schema = z.object({
  concerns: z
    .array(z.string())
    .min(1, "キャリアの悩みを1つ以上選択してください"),
  values: z
    .array(z.string())
    .min(1, "価値観を1つ以上選択してください")
    .max(3, "価値観は最大3つまで選択できます"),
  interests: z.string().optional(),
  urgency: z.string().min(1, "転職の緊急度を選択してください"),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;

export type DiagnosisData = Step1Data & Step2Data & Step3Data;
