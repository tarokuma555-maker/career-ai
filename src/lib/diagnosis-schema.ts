import { z } from "zod";

export const AGE_RANGES = [
  "20代前半",
  "20代後半",
  "30代前半",
  "30代後半",
  "40代以上",
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

// Step 1: あなたについて
export const step1Schema = z
  .object({
    ageRange: z.string().min(1, "年齢層を選択してください"),
    employmentStatus: z.string().min(1, "就業状況を選択してください"),
    jobType: z.string().min(1, "職種を選択してください"),
    jobTypeOther: z.string().optional(),
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

// Step 2: これからのこと
export const step2Schema = z.object({
  concerns: z
    .array(z.string())
    .min(1, "気になることを1つ以上選択してください"),
  values: z
    .array(z.string())
    .min(1, "大事にしたいことを1つ以上選択してください")
    .max(3, "大事にしたいことは最大3つまで選択できます"),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;

export type DiagnosisData = Step1Data & Step2Data;
