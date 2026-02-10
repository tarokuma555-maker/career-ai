"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, Heart, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  AGE_RANGES,
  EMPLOYMENT_STATUSES,
  JOB_TYPES,
  CAREER_CONCERNS,
  VALUES,
  type DiagnosisData,
} from "@/lib/diagnosis-schema";

const STEPS = [
  { title: "あなたについて", icon: User },
  { title: "これからのこと", icon: Heart },
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
  employmentStatus: string;
  jobType: string;
  jobTypeOther: string;
  // Step 2
  concerns: string[];
  values: string[];
};

const initialFormData: FormData = {
  ageRange: "",
  employmentStatus: "",
  jobType: "",
  jobTypeOther: "",
  concerns: [],
  values: [],
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
    (key: "concerns" | "values", item: string, maxItems?: number) => {
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

  const validateCurrentStep = (): boolean => {
    const schemas = [step1Schema, step2Schema];
    const stepDataMap = [
      {
        ageRange: formData.ageRange,
        employmentStatus: formData.employmentStatus,
        jobType: formData.jobType,
        jobTypeOther: formData.jobTypeOther,
      },
      {
        concerns: formData.concerns,
        values: formData.values,
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
        employmentStatus: formData.employmentStatus,
        jobType: formData.jobType,
        jobTypeOther: formData.jobTypeOther,
        concerns: formData.concerns,
        values: formData.values,
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
    <PageTransition>
    <main className="relative z-10 min-h-screen flex flex-col items-center px-4 py-12">
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
                {/* === Step 1: あなたについて === */}
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
                        現在の状況 <span className="text-destructive">*</span>
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

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        職種 <span className="text-destructive">*</span>
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
                  </div>
                )}

                {/* === Step 2: これからのこと === */}
                {currentStep === 1 && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        気になること（複数選択OK）{" "}
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
                        大事にしたいこと（最大3つ）{" "}
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
    </PageTransition>
  );
}
