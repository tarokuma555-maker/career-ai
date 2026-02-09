"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  GraduationCap,
  Briefcase,
  Award,
  Sparkles,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import PageTransition from "@/components/PageTransition";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step5Schema,
  GENDER_OPTIONS,
  EDUCATION_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  SALARY_OPTIONS,
  START_DATE_OPTIONS,
  LANGUAGE_OPTIONS,
  getYearOptions,
  MONTH_OPTIONS,
} from "@/lib/resume-schema";
import type {
  DocumentType,
  ResumeFormData,
  BasicInfo,
  EducationEntry,
  WorkEntry,
  QualificationEntry,
  LanguageEntry,
} from "@/lib/resume-types";

// ---------- Constants ----------

const STORAGE_KEY = "career-ai-resume-form";

const STEPS = [
  { title: "基本情報", icon: User },
  { title: "学歴", icon: GraduationCap },
  { title: "職歴", icon: Briefcase },
  { title: "資格・スキル", icon: Award },
  { title: "自己PR", icon: Sparkles },
  { title: "確認", icon: CheckCircle },
] as const;

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
};

const YEAR_OPTIONS = getYearOptions();

function createEmptyEducation(): EducationEntry {
  return { id: nanoid(), school: "", faculty: "", startYear: "", startMonth: "", endYear: "", endMonth: "", status: "" };
}
function createEmptyWork(): WorkEntry {
  return { id: nanoid(), company: "", department: "", position: "", employmentType: "", startYear: "", startMonth: "", endYear: "", endMonth: "", isCurrent: false, duties: "" };
}
function createEmptyQualification(): QualificationEntry {
  return { id: nanoid(), name: "", year: "", month: "" };
}
function createEmptyLanguage(): LanguageEntry {
  return { id: nanoid(), language: "", level: "" };
}

const initialFormData: ResumeFormData = {
  basicInfo: {
    lastName: "", firstName: "", lastNameKana: "", firstNameKana: "",
    birthdate: "", gender: "", zipCode: "", address: "", phone: "", email: "",
    preferences: { industry: "", position: "", salary: "", location: "", startDate: "" },
  },
  education: [createEmptyEducation(), createEmptyEducation()],
  workHistory: [createEmptyWork()],
  noWorkHistory: false,
  qualifications: [],
  skills: [],
  languages: [],
  selfPR: "",
  motivation: "",
};

// ---------- Component ----------

export default function ResumeCreatePageWrapper() {
  return (
    <Suspense fallback={
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <ResumeCreatePage />
    </Suspense>
  );
}

function ResumeCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docType = (searchParams.get("type") || "both") as DocumentType;

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [formData, setFormData] = useState<ResumeFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [customSkill, setCustomSkill] = useState("");
  const [isGeneratingPR, setIsGeneratingPR] = useState(false);
  const [isGeneratingMotivation, setIsGeneratingMotivation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Load saved form data
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ResumeFormData;
        setFormData(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-save
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(formData)), 500);
    return () => clearTimeout(t);
  }, [formData]);

  // ---------- Helpers ----------

  const updateBasicInfo = useCallback(<K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) => {
    setFormData(prev => ({ ...prev, basicInfo: { ...prev.basicInfo, [key]: value } }));
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const updatePreference = useCallback((key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, preferences: { ...prev.basicInfo.preferences, [key]: value } },
    }));
  }, []);

  const updateEducation = useCallback((id: string, key: keyof EducationEntry, value: string) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.map(e => e.id === id ? { ...e, [key]: value } : e),
    }));
    setErrors(prev => { const n = { ...prev }; delete n.education; return n; });
  }, []);

  const addEducation = useCallback(() => {
    setFormData(prev => ({ ...prev, education: [...prev.education, createEmptyEducation()] }));
  }, []);

  const removeEducation = useCallback((id: string) => {
    setFormData(prev => {
      if (prev.education.length <= 1) return prev;
      return { ...prev, education: prev.education.filter(e => e.id !== id) };
    });
  }, []);

  const updateWork = useCallback((id: string, key: keyof WorkEntry, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      workHistory: prev.workHistory.map(w => w.id === id ? { ...w, [key]: value } : w),
    }));
    setErrors(prev => { const n = { ...prev }; delete n.workHistory; return n; });
  }, []);

  const addWork = useCallback(() => {
    setFormData(prev => ({ ...prev, workHistory: [...prev.workHistory, createEmptyWork()] }));
  }, []);

  const removeWork = useCallback((id: string) => {
    setFormData(prev => {
      if (prev.workHistory.length <= 1) return prev;
      return { ...prev, workHistory: prev.workHistory.filter(w => w.id !== id) };
    });
  }, []);

  const toggleNoWork = useCallback(() => {
    setFormData(prev => ({ ...prev, noWorkHistory: !prev.noWorkHistory }));
    setErrors(prev => { const n = { ...prev }; delete n.workHistory; return n; });
  }, []);

  const addQualification = useCallback(() => {
    setFormData(prev => ({ ...prev, qualifications: [...prev.qualifications, createEmptyQualification()] }));
  }, []);

  const updateQualification = useCallback((id: string, key: keyof QualificationEntry, value: string) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.map(q => q.id === id ? { ...q, [key]: value } : q),
    }));
  }, []);

  const removeQualification = useCallback((id: string) => {
    setFormData(prev => ({ ...prev, qualifications: prev.qualifications.filter(q => q.id !== id) }));
  }, []);

  const toggleSkill = useCallback((skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) ? prev.skills.filter(s => s !== skill) : [...prev.skills, skill],
    }));
  }, []);

  const addCustomSkillHandler = useCallback(() => {
    const s = customSkill.trim();
    if (!s || formData.skills.includes(s)) return;
    setFormData(prev => ({ ...prev, skills: [...prev.skills, s] }));
    setCustomSkill("");
  }, [customSkill, formData.skills]);

  const addLanguage = useCallback(() => {
    setFormData(prev => ({ ...prev, languages: [...prev.languages, createEmptyLanguage()] }));
  }, []);

  const updateLanguage = useCallback((id: string, key: keyof LanguageEntry, value: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.map(l => l.id === id ? { ...l, [key]: value } : l),
    }));
  }, []);

  const removeLanguage = useCallback((id: string) => {
    setFormData(prev => ({ ...prev, languages: prev.languages.filter(l => l.id !== id) }));
  }, []);

  // ---------- AI Generation ----------

  const handleGenerateAI = useCallback(async (field: "selfPR" | "motivation") => {
    const setLoading = field === "selfPR" ? setIsGeneratingPR : setIsGeneratingMotivation;
    setLoading(true);
    try {
      const diagnosisData = (() => { try { return JSON.parse(localStorage.getItem("diagnosisData") || "null"); } catch { return null; } })();
      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-pr", field, formData, diagnosisData }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "生成に失敗しました"); }
      const data = await res.json();
      setFormData(prev => ({ ...prev, [field]: data[field] || prev[field] }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [formData]);

  // ---------- Validation ----------

  const validateCurrentStep = (): boolean => {
    if (currentStep === 5) return true;

    const schemas = [step1Schema, step2Schema, step3Schema, step4Schema_noop, step5Schema];
    const dataMap = [
      formData.basicInfo,
      { education: formData.education },
      { workHistory: formData.workHistory, noWorkHistory: formData.noWorkHistory },
      { skills: formData.skills, qualifications: formData.qualifications, languages: formData.languages },
      { selfPR: formData.selfPR, motivation: formData.motivation },
    ];

    // Step 3: skip validation if noWorkHistory
    if (currentStep === 2 && formData.noWorkHistory) return true;
    // Step 4: no required fields
    if (currentStep === 3) return true;

    const schema = schemas[currentStep];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (schema as any).safeParse(dataMap[currentStep]);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      (result.error.errors as { path: (string | number)[]; message: string }[]).forEach(err => {
        const key = err.path[0]?.toString();
        if (key && !fieldErrors[key]) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  // Noop schema for step 4 (no required fields)
  const step4Schema_noop = { safeParse: () => ({ success: true }) };

  // ---------- Navigation ----------

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    if (currentStep < STEPS.length - 1) {
      setHasNavigated(true);
      setDirection(1);
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setHasNavigated(true);
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    setHasNavigated(true);
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  };

  // ---------- Submit ----------

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const diagnosisData = (() => { try { return JSON.parse(localStorage.getItem("diagnosisData") || "null"); } catch { return null; } })();
      const analysisResult = (() => { try { return JSON.parse(localStorage.getItem("analysisResult") || "null"); } catch { return null; } })();
      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-document", type: docType, formData, diagnosisData, analysisResult }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "生成に失敗しました"); }
      const result = await res.json();
      localStorage.setItem("career-ai-resume-result", JSON.stringify(result));
      router.push("/resume/preview");
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const FieldError = ({ name }: { name: string }) =>
    errors[name] ? <p role="alert" className="text-sm text-destructive mt-1">{errors[name]}</p> : null;

  // Year/Month select helper
  const YearMonthSelect = ({ yearValue, monthValue, onYearChange, onMonthChange, disabled }: {
    yearValue: string; monthValue: string;
    onYearChange: (v: string) => void; onMonthChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <div className="grid grid-cols-2 gap-2">
      <Select value={yearValue} onValueChange={onYearChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="年" /></SelectTrigger>
        <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={monthValue} onValueChange={onMonthChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="月" /></SelectTrigger>
        <SelectContent>{MONTH_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl mx-auto">
          <Link href="/resume" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />タイプ選択に戻る
          </Link>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6 flex-wrap">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isCompleted = completedSteps.has(i);
              const isCurrent = i === currentStep;
              return (
                <div key={step.title} className="flex items-center gap-1 sm:gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 transition-colors ${isCurrent ? "border-primary bg-primary text-primary-foreground" : isCompleted ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/30 text-muted-foreground"}`}>
                    {isCompleted && !isCurrent ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs font-medium hidden lg:inline ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>{step.title}</span>
                  {i < STEPS.length - 1 && <div className={`w-4 sm:w-8 h-0.5 ${isCompleted ? "bg-primary" : "bg-muted-foreground/30"}`} />}
                </div>
              );
            })}
          </div>

          {/* Progress */}
          <div className="mb-8">
            <p className="text-sm text-muted-foreground mb-2">Step {currentStep + 1} / {STEPS.length}: {STEPS[currentStep].title}</p>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Form card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => { const Icon = STEPS[currentStep].icon; return <Icon className="w-5 h-5" />; })()}
                {STEPS[currentStep].title}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div key={currentStep} custom={direction} variants={slideVariants} initial={hasNavigated ? "enter" : false} animate="center" exit="exit" transition={{ duration: 0.3, ease: "easeInOut" }}>

                  {/* === Step 1: 基本情報 === */}
                  {currentStep === 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">姓 <span className="text-destructive">*</span></label>
                          <Input placeholder="大熊" value={formData.basicInfo.lastName} onChange={e => updateBasicInfo("lastName", e.target.value)} />
                          <FieldError name="lastName" />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">名 <span className="text-destructive">*</span></label>
                          <Input placeholder="太郎" value={formData.basicInfo.firstName} onChange={e => updateBasicInfo("firstName", e.target.value)} />
                          <FieldError name="firstName" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">ふりがな（姓） <span className="text-destructive">*</span></label>
                          <Input placeholder="おおくま" value={formData.basicInfo.lastNameKana} onChange={e => updateBasicInfo("lastNameKana", e.target.value)} />
                          <FieldError name="lastNameKana" />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">ふりがな（名） <span className="text-destructive">*</span></label>
                          <Input placeholder="たろう" value={formData.basicInfo.firstNameKana} onChange={e => updateBasicInfo("firstNameKana", e.target.value)} />
                          <FieldError name="firstNameKana" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">生年月日 <span className="text-destructive">*</span></label>
                        <Input type="date" value={formData.basicInfo.birthdate} onChange={e => updateBasicInfo("birthdate", e.target.value)} />
                        <FieldError name="birthdate" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">性別</label>
                        <div className="flex flex-wrap gap-3">
                          {GENDER_OPTIONS.map(g => (
                            <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                              <input type="radio" name="gender" value={g} checked={formData.basicInfo.gender === g} onChange={() => updateBasicInfo("gender", g)} className="accent-primary" />
                              {g}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">郵便番号</label>
                        <Input placeholder="100-0001" value={formData.basicInfo.zipCode} onChange={e => updateBasicInfo("zipCode", e.target.value)} className="max-w-[200px]" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">住所 <span className="text-destructive">*</span></label>
                        <Input placeholder="東京都千代田区..." value={formData.basicInfo.address} onChange={e => updateBasicInfo("address", e.target.value)} />
                        <FieldError name="address" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">電話番号 <span className="text-destructive">*</span></label>
                        <Input type="tel" placeholder="090-1234-5678" value={formData.basicInfo.phone} onChange={e => updateBasicInfo("phone", e.target.value)} />
                        <FieldError name="phone" />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">メールアドレス <span className="text-destructive">*</span></label>
                        <Input type="email" placeholder="example@email.com" value={formData.basicInfo.email} onChange={e => updateBasicInfo("email", e.target.value)} />
                        <FieldError name="email" />
                      </div>

                      {/* 希望条件 */}
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-3">希望条件（任意）</p>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">希望業界</label>
                              <Input placeholder="IT・通信" value={formData.basicInfo.preferences.industry} onChange={e => updatePreference("industry", e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">希望職種</label>
                              <Input placeholder="営業" value={formData.basicInfo.preferences.position} onChange={e => updatePreference("position", e.target.value)} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">希望年収</label>
                              <Select value={formData.basicInfo.preferences.salary} onValueChange={v => updatePreference("salary", v)}>
                                <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                                <SelectContent>{SALARY_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">入社可能時期</label>
                              <Select value={formData.basicInfo.preferences.startDate} onValueChange={v => updatePreference("startDate", v)}>
                                <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                                <SelectContent>{START_DATE_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">希望勤務地</label>
                            <Input placeholder="東京都" value={formData.basicInfo.preferences.location} onChange={e => updatePreference("location", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* === Step 2: 学歴 === */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <FieldError name="education" />
                      {formData.education.map((edu, i) => (
                        <div key={edu.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">学歴 {i + 1}</span>
                            {formData.education.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeEducation(edu.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                          <div>
                            <label className="text-sm mb-1 block">学校名 <span className="text-destructive">*</span></label>
                            <Input placeholder="○○大学" value={edu.school} onChange={e => updateEducation(edu.id, "school", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-sm mb-1 block">学部・学科</label>
                            <Input placeholder="経済学部" value={edu.faculty} onChange={e => updateEducation(edu.id, "faculty", e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm mb-1 block">入学年月 <span className="text-destructive">*</span></label>
                              <YearMonthSelect yearValue={edu.startYear} monthValue={edu.startMonth} onYearChange={v => updateEducation(edu.id, "startYear", v)} onMonthChange={v => updateEducation(edu.id, "startMonth", v)} />
                            </div>
                            <div>
                              <label className="text-sm mb-1 block">卒業年月 <span className="text-destructive">*</span></label>
                              <YearMonthSelect yearValue={edu.endYear} monthValue={edu.endMonth} onYearChange={v => updateEducation(edu.id, "endYear", v)} onMonthChange={v => updateEducation(edu.id, "endMonth", v)} />
                            </div>
                          </div>
                          <div>
                            <label className="text-sm mb-1 block">状態 <span className="text-destructive">*</span></label>
                            <div className="flex gap-3">
                              {EDUCATION_STATUS_OPTIONS.map(s => (
                                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                  <input type="radio" name={`edu-status-${edu.id}`} value={s} checked={edu.status === s} onChange={() => updateEducation(edu.id, "status", s)} className="accent-primary" />
                                  {s}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" className="w-full gap-2" onClick={addEducation}>
                        <Plus className="w-4 h-4" />学歴を追加
                      </Button>
                    </div>
                  )}

                  {/* === Step 3: 職歴 === */}
                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <FieldError name="workHistory" />
                      <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                        <input type="checkbox" checked={formData.noWorkHistory} onChange={toggleNoWork} className="rounded accent-primary" />
                        職歴なし
                      </label>
                      {!formData.noWorkHistory && (
                        <>
                          {formData.workHistory.map((w, i) => (
                            <div key={w.id} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">職歴 {i + 1}</span>
                                {formData.workHistory.length > 1 && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeWork(w.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                              <div>
                                <label className="text-sm mb-1 block">会社名 <span className="text-destructive">*</span></label>
                                <Input placeholder="株式会社ABC" value={w.company} onChange={e => updateWork(w.id, "company", e.target.value)} />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-sm mb-1 block">部署</label>
                                  <Input placeholder="営業部" value={w.department} onChange={e => updateWork(w.id, "department", e.target.value)} />
                                </div>
                                <div>
                                  <label className="text-sm mb-1 block">役職</label>
                                  <Input placeholder="主任" value={w.position} onChange={e => updateWork(w.id, "position", e.target.value)} />
                                </div>
                              </div>
                              <div>
                                <label className="text-sm mb-1 block">雇用形態 <span className="text-destructive">*</span></label>
                                <div className="flex flex-wrap gap-3">
                                  {EMPLOYMENT_TYPE_OPTIONS.map(t => (
                                    <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                      <input type="radio" name={`emp-${w.id}`} value={t} checked={w.employmentType === t} onChange={() => updateWork(w.id, "employmentType", t)} className="accent-primary" />
                                      {t}
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-sm mb-1 block">入社年月 <span className="text-destructive">*</span></label>
                                  <YearMonthSelect yearValue={w.startYear} monthValue={w.startMonth} onYearChange={v => updateWork(w.id, "startYear", v)} onMonthChange={v => updateWork(w.id, "startMonth", v)} />
                                </div>
                                <div>
                                  <label className="text-sm mb-1 block">退職年月</label>
                                  <YearMonthSelect yearValue={w.endYear} monthValue={w.endMonth} onYearChange={v => updateWork(w.id, "endYear", v)} onMonthChange={v => updateWork(w.id, "endMonth", v)} disabled={w.isCurrent} />
                                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5 cursor-pointer">
                                    <input type="checkbox" checked={w.isCurrent} onChange={e => updateWork(w.id, "isCurrent", e.target.checked)} className="rounded accent-primary" />
                                    在職中
                                  </label>
                                </div>
                              </div>
                              <div>
                                <label className="text-sm mb-1 block">業務内容 <span className="text-destructive">*</span></label>
                                <Textarea placeholder="・法人向けIT製品の提案営業を担当&#10;・年間売上目標達成率130%を記録&#10;・新規顧客20社の開拓に成功" value={w.duties} onChange={e => updateWork(w.id, "duties", e.target.value)} rows={5} />
                              </div>
                            </div>
                          ))}
                          <Button variant="outline" className="w-full gap-2" onClick={addWork}>
                            <Plus className="w-4 h-4" />職歴を追加
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {/* === Step 4: 資格・スキル === */}
                  {currentStep === 3 && (
                    <div className="space-y-5">
                      {/* 資格 */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">資格</label>
                        {formData.qualifications.map(q => (
                          <div key={q.id} className="flex items-start gap-2 mb-2">
                            <Input placeholder="資格名" value={q.name} onChange={e => updateQualification(q.id, "name", e.target.value)} className="flex-1" />
                            <Select value={q.year} onValueChange={v => updateQualification(q.id, "year", v)}>
                              <SelectTrigger className="w-28"><SelectValue placeholder="年" /></SelectTrigger>
                              <SelectContent>{YEAR_OPTIONS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={q.month} onValueChange={v => updateQualification(q.id, "month", v)}>
                              <SelectTrigger className="w-20"><SelectValue placeholder="月" /></SelectTrigger>
                              <SelectContent>{MONTH_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => removeQualification(q.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="gap-1" onClick={addQualification}>
                          <Plus className="w-3.5 h-3.5" />資格を追加
                        </Button>
                      </div>

                      {/* スキル */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">スキル</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {formData.skills.map(s => (
                            <Badge key={s} variant="default" className="cursor-pointer select-none gap-1" onClick={() => toggleSkill(s)}>
                              {s}<X className="w-3 h-3" />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input placeholder="スキルを入力してEnter" value={customSkill} onChange={e => setCustomSkill(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomSkillHandler(); } }} />
                          <Button type="button" variant="outline" size="icon" onClick={addCustomSkillHandler}><Plus className="w-4 h-4" /></Button>
                        </div>
                      </div>

                      {/* 語学 */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">語学（任意）</label>
                        {formData.languages.map(l => (
                          <div key={l.id} className="flex items-start gap-2 mb-2">
                            <Select value={l.language} onValueChange={v => updateLanguage(l.id, "language", v)}>
                              <SelectTrigger className="w-32"><SelectValue placeholder="言語" /></SelectTrigger>
                              <SelectContent>{LANGUAGE_OPTIONS.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input placeholder="TOEIC 750 / ビジネスレベル等" value={l.level} onChange={e => updateLanguage(l.id, "level", e.target.value)} className="flex-1" />
                            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => removeLanguage(l.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="gap-1" onClick={addLanguage}>
                          <Plus className="w-3.5 h-3.5" />語学を追加
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* === Step 5: 自己PR === */}
                  {currentStep === 4 && (
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-sm font-medium">自己PR <span className="text-destructive">*</span></label>
                          <span className="text-xs text-muted-foreground">{formData.selfPR.length}/400</span>
                        </div>
                        <Textarea placeholder="あなたの強みや経験をアピールしてください" value={formData.selfPR} onChange={e => setFormData(prev => ({ ...prev, selfPR: e.target.value }))} rows={6} />
                        <FieldError name="selfPR" />
                        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => handleGenerateAI("selfPR")} disabled={isGeneratingPR}>
                          {isGeneratingPR ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          AIに自己PRを生成してもらう
                        </Button>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-sm font-medium">志望動機（任意）</label>
                          <span className="text-xs text-muted-foreground">{formData.motivation.length}/400</span>
                        </div>
                        <Textarea placeholder="志望動機があれば記入してください" value={formData.motivation} onChange={e => setFormData(prev => ({ ...prev, motivation: e.target.value }))} rows={5} />
                        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => handleGenerateAI("motivation")} disabled={isGeneratingMotivation}>
                          {isGeneratingMotivation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          AIに志望動機を生成してもらう
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* === Step 6: 確認 === */}
                  {currentStep === 5 && (
                    <div className="space-y-6">
                      {/* 基本情報 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold">基本情報</h3>
                          <Button variant="ghost" size="sm" onClick={() => goToStep(0)}>編集</Button>
                        </div>
                        <div className="text-sm space-y-1 text-muted-foreground">
                          <p>{formData.basicInfo.lastName} {formData.basicInfo.firstName}（{formData.basicInfo.lastNameKana} {formData.basicInfo.firstNameKana}）</p>
                          <p>{formData.basicInfo.email} / {formData.basicInfo.phone}</p>
                          <p>{formData.basicInfo.address}</p>
                        </div>
                      </div>
                      <hr />
                      {/* 学歴 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold">学歴</h3>
                          <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>編集</Button>
                        </div>
                        <div className="text-sm space-y-1 text-muted-foreground">
                          {formData.education.filter(e => e.school).map(edu => (
                            <p key={edu.id}>{edu.startYear}{edu.startMonth} {edu.school}{edu.faculty ? ` ${edu.faculty}` : ""} ({edu.status})</p>
                          ))}
                        </div>
                      </div>
                      <hr />
                      {/* 職歴 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold">職歴</h3>
                          <Button variant="ghost" size="sm" onClick={() => goToStep(2)}>編集</Button>
                        </div>
                        {formData.noWorkHistory ? (
                          <p className="text-sm text-muted-foreground">職歴なし</p>
                        ) : (
                          <div className="text-sm space-y-2 text-muted-foreground">
                            {formData.workHistory.filter(w => w.company).map(w => (
                              <div key={w.id}>
                                <p className="font-medium text-foreground">{w.company}{w.department ? ` / ${w.department}` : ""}</p>
                                <p>{w.startYear}{w.startMonth}〜{w.isCurrent ? "現在" : `${w.endYear}${w.endMonth}`} ({w.employmentType})</p>
                                <p className="line-clamp-2">{w.duties}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <hr />
                      {/* スキル・資格 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold">資格・スキル</h3>
                          <Button variant="ghost" size="sm" onClick={() => goToStep(3)}>編集</Button>
                        </div>
                        {formData.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {formData.skills.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                          </div>
                        )}
                        {formData.qualifications.filter(q => q.name).map(q => (
                          <p key={q.id} className="text-sm text-muted-foreground">{q.name} ({q.year}{q.month})</p>
                        ))}
                        {formData.languages.filter(l => l.language).map(l => (
                          <p key={l.id} className="text-sm text-muted-foreground">{l.language}: {l.level}</p>
                        ))}
                      </div>
                      <hr />
                      {/* 自己PR */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold">自己PR</h3>
                          <Button variant="ghost" size="sm" onClick={() => goToStep(4)}>編集</Button>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{formData.selfPR}</p>
                        {formData.motivation && (
                          <>
                            <h4 className="text-sm font-medium mt-3 mb-1">志望動機</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{formData.motivation}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between pt-6 mt-6 border-t">
                <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
                  <ChevronLeft className="w-4 h-4 mr-1" />戻る
                </Button>
                <Button onClick={handleNext} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {currentStep === STEPS.length - 1 ? "書類を生成する" : "次へ"}
                  {currentStep < STEPS.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </PageTransition>
  );
}
