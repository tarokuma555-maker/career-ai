export type DocumentType = "resume" | "cv" | "both";

export interface BasicInfo {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthdate: string;
  gender: string;
  zipCode: string;
  address: string;
  phone: string;
  email: string;
  preferences: {
    industry: string;
    position: string;
    salary: string;
    location: string;
    startDate: string;
  };
}

export interface EducationEntry {
  id: string;
  school: string;
  faculty: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  status: string;
}

export interface WorkEntry {
  id: string;
  company: string;
  department: string;
  position: string;
  employmentType: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  isCurrent: boolean;
  duties: string;
}

export interface QualificationEntry {
  id: string;
  name: string;
  year: string;
  month: string;
}

export interface LanguageEntry {
  id: string;
  language: string;
  level: string;
}

export interface ResumeFormData {
  basicInfo: BasicInfo;
  education: EducationEntry[];
  workHistory: WorkEntry[];
  noWorkHistory: boolean;
  qualifications: QualificationEntry[];
  skills: string[];
  languages: LanguageEntry[];
  selfPR: string;
  motivation: string;
}

// AI生成された履歴書
export interface GeneratedResumeData {
  personalInfo: {
    name: string;
    nameKana: string;
    birthdate: string;
    age: number;
    gender: string;
    address: string;
    phone: string;
    email: string;
  };
  education: { yearMonth: string; detail: string }[];
  workHistory: { yearMonth: string; detail: string }[];
  qualifications: { yearMonth: string; detail: string }[];
  selfPR: string;
}

// AI生成された職務経歴書
export interface GeneratedCVData {
  summary: string;
  workHistory: {
    company: string;
    period: string;
    department: string;
    position: string;
    employmentType: string;
    companyDescription: string;
    responsibilities: string;
    achievements: string[];
  }[];
  skills: {
    technical: string[];
    business: string[];
    languages: string[];
  };
  qualifications: string[];
  selfPR: string;
  motivation: string;
}

// Redisに保存するデータ
export interface ResumeStoredData {
  type: DocumentType;
  formData: ResumeFormData;
  generatedResume?: GeneratedResumeData;
  generatedCV?: GeneratedCVData;
  createdAt: string;
  updatedAt: string;
}

// 統合プロフィール共有データ
export interface ProfileShareData {
  basicInfo: BasicInfo | null;
  resumeData: Omit<ResumeFormData, "basicInfo"> | null;
  generatedResume?: GeneratedResumeData;
  generatedCV?: GeneratedCVData;
  diagnosisShareId?: string;
  interviewShareId?: string;
  createdAt: string;
  updatedAt: string;
}
