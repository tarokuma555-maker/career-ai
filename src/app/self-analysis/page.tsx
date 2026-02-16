"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Gamepad2,
  Compass,
  Briefcase,
  Home,
  Settings,
  Trophy,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import PageTransition from "@/components/PageTransition";
import StepBasicInfo from "@/components/self-analysis/StepBasicInfo";
import StepHobbies from "@/components/self-analysis/StepHobbies";
import StepExperience from "@/components/self-analysis/StepExperience";
import StepWorkValues from "@/components/self-analysis/StepWorkValues";
import StepLifePlan from "@/components/self-analysis/StepLifePlan";
import StepConditions from "@/components/self-analysis/StepConditions";
import StepStrengths from "@/components/self-analysis/StepStrengths";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  step7Schema,
} from "@/lib/self-analysis-schema";
import type { SelfAnalysisData } from "@/lib/self-analysis-schema";

const STEPS = [
  { title: "基本情報と強み", icon: User },
  { title: "趣味・適性", icon: Gamepad2 },
  { title: "経験・価値観", icon: Compass },
  { title: "仕事の価値観", icon: Briefcase },
  { title: "人生設計", icon: Home },
  { title: "希望・現在の条件", icon: Settings },
  { title: "強み・改善点", icon: Trophy },
] as const;

const SCHEMAS = [
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  step7Schema,
];

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

type FormFields = Partial<SelfAnalysisData>;

const initialFormData: FormFields = {
  // Step 1
  name: "",
  naturalStrengths: [],
  naturalStrengthsOther: "",
  praisedExperiences: [],
  praisedExperiencesOther: "",
  // Step 2
  focusedHobbies: [],
  focusedHobbiesOther: "",
  longTermHobbies: [],
  longTermHobbiesOther: "",
  teachableSkills: [],
  teachableSkillsOther: "",
  // Step 3
  appreciatedExperiences: [],
  appreciatedExperiencesOther: "",
  survivalScenario: "",
  survivalScenarioOther: "",
  survivalScenarioReason: "",
  // Step 4
  workValue1: "",
  workValue1Other: "",
  workValue2: "",
  workValue2Other: "",
  workValue3: "",
  workValue3Other: "",
  workMeaning1: "",
  workMeaning2: "",
  workMeaning3: "",
  // Step 5
  marriage: "",
  children: "",
  childrenOther: "",
  rent: "",
  rentOther: "",
  priority: "",
  priorityOther: "",
  workDedication: 0,
  desiredIncome: "",
  desiredIncomeOther: "",
  // Step 6
  desiredCompanyFame: 0,
  desiredSkills: [],
  desiredSkillsOther: "",
  desiredWorkHours: "",
  desiredWorkHoursOther: "",
  desiredLocation: "",
  desiredLocationOther: "",
  desiredOvertime: "",
  desiredJobTypes: [],
  desiredJobTypesOther: "",
  desiredIndustries: [],
  desiredIndustriesOther: "",
  desiredAtmosphere: "",
  desiredAtmosphereOther: "",
  currentIncome: "",
  currentIncomeOther: "",
  currentCompanyFame: 0,
  currentSkills: [],
  currentSkillsOther: "",
  currentWorkHoursFlexibility: 0,
  currentLocation: "",
  currentLocationOther: "",
  currentOvertime: "",
  currentJobType: "",
  currentJobTypeOther: "",
  currentIndustry: "",
  currentIndustryOther: "",
  currentAtmosphere: "",
  currentAtmosphereOther: "",
  // Step 7
  strengths: [],
  strengthsOther: "",
  improvement1: "",
  improvement1Other: "",
  improvement2: "",
  improvement2Other: "",
  improvement3: "",
  improvement3Other: "",
  improvement4: "",
  improvement4Other: "",
  improvement5: "",
  improvement5Other: "",
};

function getStepData(step: number, formData: FormFields) {
  switch (step) {
    case 0:
      return {
        name: formData.name,
        naturalStrengths: formData.naturalStrengths,
        naturalStrengthsOther: formData.naturalStrengthsOther,
        praisedExperiences: formData.praisedExperiences,
        praisedExperiencesOther: formData.praisedExperiencesOther,
      };
    case 1:
      return {
        focusedHobbies: formData.focusedHobbies,
        focusedHobbiesOther: formData.focusedHobbiesOther,
        longTermHobbies: formData.longTermHobbies,
        longTermHobbiesOther: formData.longTermHobbiesOther,
        teachableSkills: formData.teachableSkills,
        teachableSkillsOther: formData.teachableSkillsOther,
      };
    case 2:
      return {
        appreciatedExperiences: formData.appreciatedExperiences,
        appreciatedExperiencesOther: formData.appreciatedExperiencesOther,
        survivalScenario: formData.survivalScenario,
        survivalScenarioOther: formData.survivalScenarioOther,
        survivalScenarioReason: formData.survivalScenarioReason,
      };
    case 3:
      return {
        workValue1: formData.workValue1,
        workValue1Other: formData.workValue1Other,
        workValue2: formData.workValue2,
        workValue2Other: formData.workValue2Other,
        workValue3: formData.workValue3,
        workValue3Other: formData.workValue3Other,
        workMeaning1: formData.workMeaning1,
        workMeaning2: formData.workMeaning2,
        workMeaning3: formData.workMeaning3,
      };
    case 4:
      return {
        marriage: formData.marriage,
        children: formData.children,
        childrenOther: formData.childrenOther,
        rent: formData.rent,
        rentOther: formData.rentOther,
        priority: formData.priority,
        priorityOther: formData.priorityOther,
        workDedication: formData.workDedication,
        desiredIncome: formData.desiredIncome,
        desiredIncomeOther: formData.desiredIncomeOther,
      };
    case 5:
      return {
        desiredCompanyFame: formData.desiredCompanyFame,
        desiredSkills: formData.desiredSkills,
        desiredSkillsOther: formData.desiredSkillsOther,
        desiredWorkHours: formData.desiredWorkHours,
        desiredWorkHoursOther: formData.desiredWorkHoursOther,
        desiredLocation: formData.desiredLocation,
        desiredLocationOther: formData.desiredLocationOther,
        desiredOvertime: formData.desiredOvertime,
        desiredJobTypes: formData.desiredJobTypes,
        desiredJobTypesOther: formData.desiredJobTypesOther,
        desiredIndustries: formData.desiredIndustries,
        desiredIndustriesOther: formData.desiredIndustriesOther,
        desiredAtmosphere: formData.desiredAtmosphere,
        desiredAtmosphereOther: formData.desiredAtmosphereOther,
        currentIncome: formData.currentIncome,
        currentIncomeOther: formData.currentIncomeOther,
        currentCompanyFame: formData.currentCompanyFame,
        currentSkills: formData.currentSkills,
        currentSkillsOther: formData.currentSkillsOther,
        currentWorkHoursFlexibility: formData.currentWorkHoursFlexibility,
        currentLocation: formData.currentLocation,
        currentLocationOther: formData.currentLocationOther,
        currentOvertime: formData.currentOvertime,
        currentJobType: formData.currentJobType,
        currentJobTypeOther: formData.currentJobTypeOther,
        currentIndustry: formData.currentIndustry,
        currentIndustryOther: formData.currentIndustryOther,
        currentAtmosphere: formData.currentAtmosphere,
        currentAtmosphereOther: formData.currentAtmosphereOther,
      };
    case 6:
      return {
        strengths: formData.strengths,
        strengthsOther: formData.strengthsOther,
        improvement1: formData.improvement1,
        improvement1Other: formData.improvement1Other,
        improvement2: formData.improvement2,
        improvement2Other: formData.improvement2Other,
        improvement3: formData.improvement3,
        improvement3Other: formData.improvement3Other,
        improvement4: formData.improvement4,
        improvement4Other: formData.improvement4Other,
        improvement5: formData.improvement5,
        improvement5Other: formData.improvement5Other,
      };
    default:
      return {};
  }
}

function SelfAnalysisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagnosisId = searchParams.get("diagnosisId");

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [formData, setFormData] = useState<FormFields>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const updateField = useCallback(
    <K extends keyof SelfAnalysisData>(key: K, value: SelfAnalysisData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const toggleArrayItem = useCallback(
    (key: keyof SelfAnalysisData, item: string) => {
      setFormData((prev) => {
        const current = (prev[key] as string[]) || [];
        if (current.includes(item)) {
          return { ...prev, [key]: current.filter((v) => v !== item) };
        }
        return { ...prev, [key]: [...current, item] };
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const validateCurrentStep = (): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = SCHEMAS[currentStep] as any;
    const data = getStepData(currentStep, formData);
    const result = schema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      (
        result.error.errors as { path: (string | number)[]; message: string }[]
      ).forEach(
        (err: { path: (string | number)[]; message: string }) => {
          const key = err.path[0]?.toString();
          if (key && !fieldErrors[key]) {
            fieldErrors[key] = err.message;
          }
        },
      );
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!diagnosisId) {
      setErrors({ _form: "診断IDが見つかりません。" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/self-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosisId,
          answers: formData,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrors({ _form: data.error || "保存に失敗しました。" });
        return;
      }
      router.push("/self-analysis/complete");
    } catch {
      setErrors({ _form: "通信エラーが発生しました。" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    if (currentStep < STEPS.length - 1) {
      setHasNavigated(true);
      setDirection(1);
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setHasNavigated(true);
      setDirection(-1);
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!diagnosisId) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">
                診断IDが指定されていません。先に診断を完了してください。
              </p>
              <Button className="mt-4" onClick={() => router.push("/")}>
                トップへ戻る
              </Button>
            </CardContent>
          </Card>
        </main>
      </PageTransition>
    );
  }

  const stepComponents = [
    <StepBasicInfo
      key="s1"
      formData={formData}
      updateField={updateField}
      toggleArrayItem={toggleArrayItem}
      errors={errors}
    />,
    <StepHobbies
      key="s2"
      formData={formData}
      updateField={updateField}
      toggleArrayItem={toggleArrayItem}
      errors={errors}
    />,
    <StepExperience
      key="s3"
      formData={formData}
      updateField={updateField}
      toggleArrayItem={toggleArrayItem}
      errors={errors}
    />,
    <StepWorkValues
      key="s4"
      formData={formData}
      updateField={updateField}
      toggleArrayItem={toggleArrayItem}
      errors={errors}
    />,
    <StepLifePlan
      key="s5"
      formData={formData}
      updateField={updateField}
      toggleArrayItem={toggleArrayItem}
      errors={errors}
    />,
    <StepConditions
      key="s6"
      formData={formData}
      updateField={updateField}
      toggleArrayItem={toggleArrayItem}
      errors={errors}
    />,
    <StepStrengths
      key="s7"
      formData={formData}
      updateField={updateField}
      toggleArrayItem={toggleArrayItem}
      errors={errors}
    />,
  ];

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl mx-auto">
          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6 flex-wrap">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isCompleted = completedSteps.has(i);
              const isCurrent = i === currentStep;
              return (
                <div key={step.title} className="flex items-center gap-0.5 sm:gap-1">
                  <div
                    className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 transition-colors ${
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
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-3 sm:w-6 h-0.5 ${
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
              Step {currentStep + 1} / {STEPS.length}:{" "}
              {STEPS[currentStep].title}
            </p>
            <Progress
              value={progress}
              className="h-2"
              aria-label={`自己分析の進捗: ステップ${currentStep + 1}/${STEPS.length}`}
            />
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
                  {stepComponents[currentStep]}
                </motion.div>
              </AnimatePresence>

              {errors._form && (
                <p role="alert" className="text-sm text-destructive mt-4">
                  {errors._form}
                </p>
              )}

              {/* ナビゲーションボタン */}
              <div className="flex justify-between pt-6 mt-6 border-t">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0 || submitting}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  戻る
                </Button>
                <Button onClick={handleNext} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      送信中...
                    </>
                  ) : currentStep === STEPS.length - 1 ? (
                    "送信する"
                  ) : (
                    <>
                      次へ
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </PageTransition>
  );
}

export default function SelfAnalysisPage() {
  return (
    <Suspense
      fallback={
        <main className="relative z-10 min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      }
    >
      <SelfAnalysisForm />
    </Suspense>
  );
}
