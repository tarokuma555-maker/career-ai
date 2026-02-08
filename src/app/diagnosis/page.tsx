"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, Briefcase, Heart, Check, ChevronRight, ChevronLeft, Plus, X } from "lucide-react";
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
import {
  step1Schema,
  step2Schema,
  step3Schema,
  AGE_RANGES,
  EDUCATION_LEVELS,
  EMPLOYMENT_STATUSES,
  JOB_TYPES,
  INDUSTRIES,
  EXPERIENCE_YEARS,
  SKILL_OPTIONS,
  CAREER_CONCERNS,
  VALUES,
  URGENCY_OPTIONS,
  type DiagnosisData,
} from "@/lib/diagnosis-schema";

const STEPS = [
  { title: "基本情報", icon: User },
  { title: "経歴・スキル", icon: Briefcase },
  { title: "希望・価値観", icon: Heart },
] as const;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

type FormData = {
  // Step 1
  ageRange: string;
  education: string;
  employmentStatus: string;
  // Step 2
  jobType: string;
  jobTypeOther: string;
  industry: string;
  experienceYears: string;
  skills: string[];
  customSkill: string;
  certifications: string;
  // Step 3
  concerns: string[];
  values: string[];
  interests: string;
  urgency: string;
};

const initialFormData: FormData = {
  ageRange: "",
  education: "",
  employmentStatus: "",
  jobType: "",
  jobTypeOther: "",
  industry: "",
  experienceYears: "",
  skills: [],
  customSkill: "",
  certifications: "",
  concerns: [],
  values: [],
  interests: "",
  urgency: "",
};

export default function DiagnosisPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  const toggleArrayItem = useCallback(
    (key: "skills" | "concerns" | "values", item: string, maxItems?: number) => {
      setFormData((prev) => {
        const current = prev[key];
        if (current.includes(item)) {
          return { ...prev, [key]: current.filter((v) => v !== item) };
        }
        if (maxItems && current.length >= maxItems) return prev;
        return { ...prev, [key]: [...current, item] };
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  const addCustomSkill = useCallback(() => {
    const skill = formData.customSkill.trim();
    if (!skill) return;
    if (formData.skills.includes(skill)) return;
    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, skill],
      customSkill: "",
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.skills;
      return next;
    });
  }, [formData.customSkill, formData.skills]);

  const validateCurrentStep = (): boolean => {
    const schemas = [step1Schema, step2Schema, step3Schema];
    const stepDataMap = [
      {
        ageRange: formData.ageRange,
        education: formData.education,
        employmentStatus: formData.employmentStatus,
      },
      {
        jobType: formData.jobType,
        jobTypeOther: formData.jobTypeOther,
        industry: formData.industry,
        experienceYears: formData.experienceYears,
        skills: formData.skills,
        customSkill: formData.customSkill,
        certifications: formData.certifications,
      },
      {
        concerns: formData.concerns,
        values: formData.values,
        interests: formData.interests,
        urgency: formData.urgency,
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = schemas[currentStep] as any;
    const result = schema.safeParse(stepDataMap[currentStep]);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      (result.error.errors as { path: (string | number)[]; message: string }[]).forEach((err) => {
        const key = err.path[0]?.toString();
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    if (currentStep < STEPS.length - 1) {
      setHasNavigated(true);
      setDirection(1);
      setCurrentStep(currentStep + 1);
    } else {
      const dataToSave: DiagnosisData = {
        ageRange: formData.ageRange,
        education: formData.education,
        employmentStatus: formData.employmentStatus,
        jobType: formData.jobType,
        jobTypeOther: formData.jobTypeOther,
        industry: formData.industry,
        experienceYears: formData.experienceYears,
        skills: formData.skills,
        customSkill: formData.customSkill,
        certifications: formData.certifications,
        concerns: formData.concerns,
        values: formData.values,
        interests: formData.interests,
        urgency: formData.urgency,
      };
      localStorage.setItem("diagnosisData", JSON.stringify(dataToSave));
      router.push("/analyzing");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setHasNavigated(true);
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const FieldError = ({ name }: { name: string }) =>
    errors[name] ? (
      <p role="alert" className="text-sm text-destructive mt-1">{errors[name]}</p>
    ) : null;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl mx-auto">
        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.has(i);
            const isCurrent = i === currentStep;
            return (
              <div key={step.title} className="flex items-center gap-1 sm:gap-2">
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-colors ${
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCompleted
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium hidden sm:inline ${
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-6 sm:w-12 h-0.5 ${
                      isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* プログレスバー */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-2">
            Step {currentStep + 1} / {STEPS.length}: {STEPS[currentStep].title}
          </p>
          <Progress value={progress} className="h-2" aria-label={`診断の進捗: ステップ${currentStep + 1}/${STEPS.length}`} />
        </div>

        {/* フォームカード */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const Icon = STEPS[currentStep].icon;
                return <Icon className="w-5 h-5" />;
              })()}
              {STEPS[currentStep].title}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial={hasNavigated ? "enter" : false}
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {/* === Step 1: 基本情報 === */}
                {currentStep === 0 && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        年齢層 <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.ageRange}
                        onValueChange={(v) => updateField("ageRange", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGE_RANGES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError name="ageRange" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        最終学歴 <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.education}
                        onValueChange={(v) => updateField("education", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {EDUCATION_LEVELS.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError name="education" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        現在の就業状況 <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.employmentStatus}
                        onValueChange={(v) => updateField("employmentStatus", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {EMPLOYMENT_STATUSES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError name="employmentStatus" />
                    </div>
                  </div>
                )}

                {/* === Step 2: 経歴・スキル === */}
                {currentStep === 1 && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        現在（または直近）の職種{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.jobType}
                        onValueChange={(v) => updateField("jobType", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_TYPES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError name="jobType" />
                      {formData.jobType === "その他" && (
                        <div className="mt-2">
                          <Input
                            placeholder="職種を入力してください"
                            value={formData.jobTypeOther}
                            onChange={(e) =>
                              updateField("jobTypeOther", e.target.value)
                            }
                          />
                          <FieldError name="jobTypeOther" />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        業界 <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.industry}
                        onValueChange={(v) => updateField("industry", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError name="industry" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        経験年数 <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.experienceYears}
                        onValueChange={(v) => updateField("experienceYears", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPERIENCE_YEARS.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError name="experienceYears" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        得意なスキル <span className="text-destructive">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {SKILL_OPTIONS.map((skill) => (
                          <Badge
                            key={skill}
                            role="button"
                            tabIndex={0}
                            aria-pressed={formData.skills.includes(skill)}
                            variant={
                              formData.skills.includes(skill)
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer select-none transition-colors"
                            onClick={() => toggleArrayItem("skills", skill)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleArrayItem("skills", skill); } }}
                          >
                            {skill}
                          </Badge>
                        ))}
                        {formData.skills
                          .filter(
                            (s) =>
                              !SKILL_OPTIONS.includes(
                                s as (typeof SKILL_OPTIONS)[number]
                              )
                          )
                          .map((skill) => (
                            <Badge
                              key={skill}
                              role="button"
                              tabIndex={0}
                              variant="default"
                              className="cursor-pointer select-none gap-1"
                              onClick={() => toggleArrayItem("skills", skill)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleArrayItem("skills", skill); } }}
                            >
                              {skill}
                              <X className="w-3 h-3" aria-hidden="true" />
                            </Badge>
                          ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="その他のスキルを追加"
                          value={formData.customSkill}
                          onChange={(e) =>
                            updateField("customSkill", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomSkill();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={addCustomSkill}
                          aria-label="スキルを追加"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <FieldError name="skills" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        保有資格（任意）
                      </label>
                      <Textarea
                        placeholder="例: TOEIC 800点、基本情報技術者、簿記2級..."
                        value={formData.certifications}
                        onChange={(e) =>
                          updateField("certifications", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* === Step 3: 希望・価値観 === */}
                {currentStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        キャリアの悩み（複数選択可）{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {CAREER_CONCERNS.map((concern) => (
                          <Badge
                            key={concern}
                            role="button"
                            tabIndex={0}
                            aria-pressed={formData.concerns.includes(concern)}
                            variant={
                              formData.concerns.includes(concern)
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer select-none transition-colors"
                            onClick={() => toggleArrayItem("concerns", concern)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleArrayItem("concerns", concern); } }}
                          >
                            {concern}
                          </Badge>
                        ))}
                      </div>
                      <FieldError name="concerns" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        重視する価値観（最大3つ）{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {VALUES.map((value) => {
                          const selected = formData.values.includes(value);
                          const disabled = !selected && formData.values.length >= 3;
                          return (
                            <Badge
                              key={value}
                              role="button"
                              tabIndex={disabled ? -1 : 0}
                              aria-pressed={selected}
                              aria-disabled={disabled}
                              variant={selected ? "default" : "outline"}
                              className={`cursor-pointer select-none transition-colors ${
                                disabled ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                              onClick={() => toggleArrayItem("values", value, 3)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleArrayItem("values", value, 3); } }}
                            >
                              {value}
                            </Badge>
                          );
                        })}
                      </div>
                      {formData.values.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formData.values.length}/3 選択中
                        </p>
                      )}
                      <FieldError name="values" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        興味のある分野（任意）
                      </label>
                      <Textarea
                        placeholder="例: AI・機械学習、Webサービス開発、UXデザイン..."
                        value={formData.interests}
                        onChange={(e) =>
                          updateField("interests", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        転職の緊急度 <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={formData.urgency}
                        onValueChange={(v) => updateField("urgency", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {URGENCY_OPTIONS.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError name="urgency" />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ナビゲーションボタン */}
            <div className="flex justify-between pt-6 mt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                戻る
              </Button>
              <Button onClick={handleNext}>
                {currentStep === STEPS.length - 1 ? "診断する" : "次へ"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
