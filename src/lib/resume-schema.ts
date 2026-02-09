import { z } from "zod";

// ---------- 定数 ----------

export const GENDER_OPTIONS = ["男", "女", "その他", "回答しない"] as const;

export const EDUCATION_STATUS_OPTIONS = ["卒業", "中退", "在学中"] as const;

export const EMPLOYMENT_TYPE_OPTIONS = [
  "正社員",
  "契約社員",
  "派遣社員",
  "パート・アルバイト",
] as const;

export const SALARY_OPTIONS = [
  "300万円",
  "350万円",
  "400万円",
  "450万円",
  "500万円",
  "550万円",
  "600万円",
  "650万円",
  "700万円",
  "750万円",
  "800万円",
  "850万円",
  "900万円",
  "950万円",
  "1000万円以上",
] as const;

export const START_DATE_OPTIONS = [
  "即日",
  "1ヶ月以内",
  "3ヶ月以内",
  "半年以内",
  "未定",
] as const;

export const LANGUAGE_OPTIONS = [
  "英語",
  "中国語",
  "韓国語",
  "フランス語",
  "ドイツ語",
  "スペイン語",
  "その他",
] as const;

// 年の選択肢（1970〜現在+5年）
export function getYearOptions(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current + 5; y >= 1970; y--) {
    years.push(`${y}年`);
  }
  return years;
}

export const MONTH_OPTIONS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
] as const;

// ---------- Step 1: 基本情報 ----------
export const step1Schema = z.object({
  lastName: z.string().min(1, "姓を入力してください"),
  firstName: z.string().min(1, "名を入力してください"),
  lastNameKana: z.string().min(1, "姓のふりがなを入力してください"),
  firstNameKana: z.string().min(1, "名のふりがなを入力してください"),
  birthdate: z.string().min(1, "生年月日を入力してください"),
  address: z.string().min(1, "住所を入力してください"),
  phone: z.string().min(1, "電話番号を入力してください"),
  email: z.string().email("正しいメールアドレスを入力してください"),
});

// ---------- Step 2: 学歴 ----------
export const educationEntrySchema = z.object({
  id: z.string(),
  school: z.string().min(1, "学校名を入力してください"),
  faculty: z.string().optional(),
  startYear: z.string().min(1, "入学年を選択してください"),
  startMonth: z.string().min(1, "入学月を選択してください"),
  endYear: z.string().min(1, "卒業年を選択してください"),
  endMonth: z.string().min(1, "卒業月を選択してください"),
  status: z.string().min(1, "状態を選択してください"),
});

export const step2Schema = z.object({
  education: z
    .array(educationEntrySchema)
    .min(1, "学歴を1つ以上入力してください"),
});

// ---------- Step 3: 職歴 ----------
export const workEntrySchema = z.object({
  id: z.string(),
  company: z.string().min(1, "会社名を入力してください"),
  department: z.string().optional(),
  position: z.string().optional(),
  employmentType: z.string().min(1, "雇用形態を選択してください"),
  startYear: z.string().min(1, "入社年を選択してください"),
  startMonth: z.string().min(1, "入社月を選択してください"),
  endYear: z.string().optional(),
  endMonth: z.string().optional(),
  isCurrent: z.boolean(),
  duties: z.string().min(1, "業務内容を入力してください"),
});

export const step3Schema = z.object({
  workHistory: z.array(workEntrySchema),
  noWorkHistory: z.boolean(),
});

// ---------- Step 4: スキル・資格 ----------
export const step4Schema = z.object({
  skills: z.array(z.string()),
  qualifications: z.array(z.object({
    id: z.string(),
    name: z.string(),
    year: z.string(),
    month: z.string(),
  })),
  languages: z.array(z.object({
    id: z.string(),
    language: z.string(),
    level: z.string(),
  })),
});

// ---------- Step 5: 自己PR ----------
export const step5Schema = z.object({
  selfPR: z.string().min(1, "自己PRを入力してください"),
  motivation: z.string().optional(),
});
