import { z } from "zod";

// ============================================================
// Step 1: 基本情報と強み
// ============================================================

export const NATURAL_STRENGTHS = [
  "コミュニケーション",
  "問題解決",
  "組織能力",
  "技術的スキル",
  "創造性",
] as const;

export const PRAISED_EXPERIENCES = [
  "仕事のスピード",
  "注意力",
  "創造的アイデア",
  "チームワーク",
  "リーダーシップ",
] as const;

export const step1Schema = z.object({
  name: z.string().min(1, "氏名を入力してください"),
  naturalStrengths: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  naturalStrengthsOther: z.string().optional(),
  praisedExperiences: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  praisedExperiencesOther: z.string().optional(),
});

export type SelfAnalysisStep1 = z.infer<typeof step1Schema>;

// ============================================================
// Step 2: 趣味・適性
// ============================================================

export const FOCUSED_HOBBIES = [
  "読書",
  "スポーツやフィットネス",
  "アートやクラフト",
  "音楽",
  "ゲームやパズル",
] as const;

export const LONG_TERM_HOBBIES = [
  "スポーツ",
  "アートや手工芸",
  "音楽",
  "写真撮影",
  "読書や執筆",
] as const;

export const TEACHABLE_SKILLS = [
  "コンピュータープログラミング",
  "データ分析",
  "プロジェクト管理",
  "マーケティング",
  "財務管理",
  "人事管理",
  "グラフィックデザイン",
  "営業技術",
  "顧客サービス",
  "製造・技術スキル",
] as const;

export const step2Schema = z.object({
  focusedHobbies: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  focusedHobbiesOther: z.string().optional(),
  longTermHobbies: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  longTermHobbiesOther: z.string().optional(),
  teachableSkills: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  teachableSkillsOther: z.string().optional(),
});

export type SelfAnalysisStep2 = z.infer<typeof step2Schema>;

// ============================================================
// Step 3: 経験・価値観
// ============================================================

export const APPRECIATED_EXPERIENCES = [
  "学校のプロジェクト",
  "ボランティア活動",
  "家族へのサポート",
  "友人への助け",
  "仕事上の協力",
  "学業支援",
  "イベントの企画・運営",
  "創造的な貢献",
  "スポーツやクラブ活動",
  "緊急時の対応",
] as const;

export const SURVIVAL_SCENARIOS = [
  "安全な場所を探す",
  "救助信号を送る",
  "怪我人の応急処置",
  "食料と水の確保",
  "火を起こす",
  "情報の収集",
  "集団を組織する",
  "シェルターの建設",
  "探索隊を組む",
  "定期的なミーティング設定",
] as const;

export const step3Schema = z.object({
  appreciatedExperiences: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  appreciatedExperiencesOther: z.string().optional(),
  survivalScenario: z.string().min(1, "1つ選択してください"),
  survivalScenarioOther: z.string().optional(),
  survivalScenarioReason: z.string().min(1, "理由を入力してください"),
});

export type SelfAnalysisStep3 = z.infer<typeof step3Schema>;

// ============================================================
// Step 4: 仕事の価値観
// ============================================================

export const WORK_VALUES = [
  "仕事とプライベートのバランス",
  "キャリア成長",
  "チームワーク",
  "仕事の意義",
  "収入と経済的安定",
  "柔軟性と自立",
  "創造性と革新",
  "リーダーシップと影響力",
  "専門性の習得",
  "職場の文化と環境",
] as const;

export const WORK_MEANINGS = [
  "お金を稼ぐ",
  "夢を追う",
  "みんなのために",
  "自分を表現",
  "新しいことを学ぶ",
  "友達を作る",
  "安定した生活",
  "冒険する",
  "尊敬される",
  "好きな生活を送る",
] as const;

export const step4Schema = z
  .object({
    workValue1: z.string().min(1, "1位を選択してください"),
    workValue1Other: z.string().optional(),
    workValue2: z.string().min(1, "2位を選択してください"),
    workValue2Other: z.string().optional(),
    workValue3: z.string().min(1, "3位を選択してください"),
    workValue3Other: z.string().optional(),
    workMeaning1: z.string().min(1, "1位を選択してください"),
    workMeaning2: z.string().min(1, "2位を選択してください"),
    workMeaning3: z.string().min(1, "3位を選択してください"),
  })
  .refine(
    (data) => {
      const values = [data.workValue1, data.workValue2, data.workValue3];
      return new Set(values).size === values.length;
    },
    { message: "大切にしたいことTOP3は重複しないようにしてください" }
  )
  .refine(
    (data) => {
      const meanings = [
        data.workMeaning1,
        data.workMeaning2,
        data.workMeaning3,
      ];
      return new Set(meanings).size === meanings.length;
    },
    { message: "働くとはTOP3は重複しないようにしてください" }
  );

export type SelfAnalysisStep4 = z.infer<typeof step4Schema>;

// ============================================================
// Step 5: 人生設計
// ============================================================

export const MARRIAGE_OPTIONS = [
  "すでに結婚をしている",
  "確実に結婚している",
  "たぶん結婚している",
  "できるなら結婚したい",
  "できるなら結婚したくない",
  "確実に結婚していない",
] as const;

export const CHILDREN_OPTIONS = [
  "2人以上はいる",
  "1人はいる",
  "相手がほしいという人ならいると思う",
  "経済的に余裕があればほしい",
  "子どもは特にほしいとは思わない",
] as const;

export const RENT_OPTIONS = [
  "5万",
  "7万",
  "9万",
  "11万",
  "13万",
  "15万",
  "20万以上",
] as const;

export const PRIORITY_OPTIONS = [
  "趣味",
  "家庭",
  "仕事",
] as const;

export const DESIRED_INCOME_OPTIONS = [
  "３００～４００万円",
  "４００～５００万円",
  "５００～６００万円",
  "６００〜７００万円",
  "７００〜８００万円",
  "８００万円以上",
] as const;

export const step5Schema = z.object({
  marriage: z.string().min(1, "選択してください"),
  children: z.string().min(1, "選択してください"),
  childrenOther: z.string().optional(),
  rent: z.string().min(1, "選択してください"),
  rentOther: z.string().optional(),
  priority: z.string().min(1, "選択してください"),
  priorityOther: z.string().optional(),
  workDedication: z
    .number()
    .min(1, "1〜5の範囲で選択してください")
    .max(5, "1〜5の範囲で選択してください"),
  desiredIncome: z.string().min(1, "選択してください"),
  desiredIncomeOther: z.string().optional(),
});

export type SelfAnalysisStep5 = z.infer<typeof step5Schema>;

// ============================================================
// Step 6: 希望・現在の条件
// ============================================================

export const DESIRED_SKILLS = [
  "専門的なスキル",
  "コミュニケーションスキル",
  "情報収集力",
  "問題解決力",
  "リーダーシップ力",
] as const;

export const WORK_HOURS_OPTIONS = [
  "９時～１８時",
  "コアタイムあり",
  "フルフレックス",
] as const;

export const DESIRED_LOCATION_OPTIONS = [
  "関東",
  "東京",
  "関西",
  "大阪",
] as const;

export const OVERTIME_VALUES = [
  "仕事のためなら常識の範囲で何時間でも可",
  "残業は４０〜６０時間でも可",
  "残業は２０〜４０時間",
  "残業は１０〜２０時間",
  "残業はほぼなしの０〜５時間",
] as const;

export const JOB_TYPE_OPTIONS = [
  "営業",
  "事務",
  "マーケター",
  "人事",
  "SE",
  "広告",
] as const;

export const INDUSTRY_OPTIONS = [
  "IT・通信系",
  "メーカー",
  "商社",
  "流通・小売り",
  "専門コンサル系",
  "建築",
  "サービス",
] as const;

export const WORKPLACE_ATMOSPHERE_OPTIONS = [
  "仲良し・アットホーム",
  "切磋琢磨",
  "あまりコミュニケーションをとらない",
] as const;

export const CURRENT_SKILLS = [
  "ブラインドタッチ",
  "コミュニケーション力",
  "情報収集力",
  "リーダーシップ力",
  "問題解決力",
] as const;

export const CURRENT_LOCATION_OPTIONS = [
  "東京",
  "埼玉",
  "千葉",
  "神奈川",
  "大阪",
  "京都",
  "兵庫",
] as const;

export const CURRENT_OVERTIME_OPTIONS = [
  "６０時間以上",
  "４０〜６０時間",
  "２０〜４０時間",
  "１０〜２０時間",
  "残業はほぼなしの０〜５時間",
] as const;

export const step6Schema = z.object({
  // --- 希望条件 ---
  desiredCompanyFame: z
    .number()
    .min(1, "1〜5の範囲で選択してください")
    .max(5, "1〜5の範囲で選択してください"),
  desiredSkills: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  desiredSkillsOther: z.string().optional(),
  desiredWorkHours: z.string().min(1, "選択してください"),
  desiredWorkHoursOther: z.string().optional(),
  desiredLocation: z.string().min(1, "選択してください"),
  desiredLocationOther: z.string().optional(),
  desiredOvertime: z.string().min(1, "選択してください"),
  desiredJobTypes: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  desiredJobTypesOther: z.string().optional(),
  desiredIndustries: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  desiredIndustriesOther: z.string().optional(),
  desiredAtmosphere: z.string().min(1, "選択してください"),
  desiredAtmosphereOther: z.string().optional(),
  // --- 現在の状況 ---
  currentIncome: z.string().min(1, "選択してください"),
  currentIncomeOther: z.string().optional(),
  currentCompanyFame: z
    .number()
    .min(1, "1〜5の範囲で選択してください")
    .max(5, "1〜5の範囲で選択してください"),
  currentSkills: z
    .array(z.string())
    .min(1, "少なくとも1つ選択してください"),
  currentSkillsOther: z.string().optional(),
  currentWorkHoursFlexibility: z
    .number()
    .min(1, "1〜5の範囲で選択してください")
    .max(5, "1〜5の範囲で選択してください"),
  currentLocation: z.string().min(1, "選択してください"),
  currentLocationOther: z.string().optional(),
  currentOvertime: z.string().min(1, "選択してください"),
  currentJobType: z.string().min(1, "選択してください"),
  currentJobTypeOther: z.string().optional(),
  currentIndustry: z.string().min(1, "選択してください"),
  currentIndustryOther: z.string().optional(),
  currentAtmosphere: z.string().min(1, "選択してください"),
  currentAtmosphereOther: z.string().optional(),
});

export type SelfAnalysisStep6 = z.infer<typeof step6Schema>;

// ============================================================
// Step 7: 強み・改善点
// ============================================================

export const STRENGTH_OPTIONS = [
  "課題発見力",
  "問題解決力",
  "計画実行力",
  "計画策定力",
  "情報分析力",
  "トラブル対応力",
  "コミュニケーション能力",
  "交渉力",
  "プレゼン力",
  "営業力",
  "提案力",
  "傾聴力",
  "リーダーシップ",
  "主体性",
  "チームマネジメント力",
  "協調性",
  "成長意欲",
  "指導力",
] as const;

export const IMPROVEMENT_OPTIONS = [
  "年収を上げる",
  "知名度のある企業",
  "スキルを身に着けたい",
  "フレックスで時間の融通がきく",
  "やりがいのある仕事",
  "勤務地を選べる",
  "勤務地を変えたい",
  "残業が少なくワークライフバランスがいいこと",
  "職種",
  "役職",
  "職場の雰囲気",
] as const;

export const step7Schema = z
  .object({
    strengths: z.array(z.string()),
    strengthsOther: z.string().optional(),
    improvement1: z.string().min(1, "1位を選択してください"),
    improvement1Other: z.string().optional(),
    improvement2: z.string().min(1, "2位を選択してください"),
    improvement2Other: z.string().optional(),
    improvement3: z.string().min(1, "3位を選択してください"),
    improvement3Other: z.string().optional(),
    improvement4: z.string().min(1, "4位を選択してください"),
    improvement4Other: z.string().optional(),
    improvement5: z.string().min(1, "5位を選択してください"),
    improvement5Other: z.string().optional(),
  })
  .refine(
    (data) => {
      const improvements = [
        data.improvement1,
        data.improvement2,
        data.improvement3,
        data.improvement4,
        data.improvement5,
      ];
      return new Set(improvements).size === improvements.length;
    },
    { message: "改善ポイントは重複しないようにしてください" }
  );

export type SelfAnalysisStep7 = z.infer<typeof step7Schema>;

// ============================================================
// Combined type for all steps
// ============================================================

export type SelfAnalysisData = SelfAnalysisStep1 &
  SelfAnalysisStep2 &
  SelfAnalysisStep3 &
  SelfAnalysisStep4 &
  SelfAnalysisStep5 &
  SelfAnalysisStep6 &
  SelfAnalysisStep7;
