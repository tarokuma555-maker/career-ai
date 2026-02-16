"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  NATURAL_STRENGTHS,
  PRAISED_EXPERIENCES,
} from "@/lib/self-analysis-schema";
import type { SelfAnalysisData } from "@/lib/self-analysis-schema";

interface StepProps {
  formData: Partial<SelfAnalysisData>;
  updateField: <K extends keyof SelfAnalysisData>(
    key: K,
    value: SelfAnalysisData[K],
  ) => void;
  toggleArrayItem: (key: keyof SelfAnalysisData, item: string) => void;
  errors: Record<string, string>;
}

export default function StepBasicInfo({
  formData,
  updateField,
  toggleArrayItem,
  errors,
}: StepProps) {
  const FieldError = ({ name }: { name: string }) =>
    errors[name] ? (
      <p role="alert" className="text-sm text-destructive mt-1">
        {errors[name]}
      </p>
    ) : null;

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          氏名 <span className="text-destructive">*</span>
        </label>
        <Input
          placeholder="例: 山田太郎"
          value={(formData.name as string) || ""}
          onChange={(e) => updateField("name", e.target.value)}
        />
        <FieldError name="name" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          自然にできること・得意なこと（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {NATURAL_STRENGTHS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.naturalStrengths as string[]) || []
              ).includes(item)}
              variant={
                ((formData.naturalStrengths as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("naturalStrengths", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("naturalStrengths", item);
                }
              }}
            >
              {item}
            </Badge>
          ))}
        </div>
        <Input
          placeholder="その他（自由記入）"
          className="mt-2"
          value={(formData.naturalStrengthsOther as string) || ""}
          onChange={(e) =>
            updateField("naturalStrengthsOther", e.target.value)
          }
        />
        <FieldError name="naturalStrengths" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          人に褒められた経験（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PRAISED_EXPERIENCES.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.praisedExperiences as string[]) || []
              ).includes(item)}
              variant={
                ((formData.praisedExperiences as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("praisedExperiences", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("praisedExperiences", item);
                }
              }}
            >
              {item}
            </Badge>
          ))}
        </div>
        <Input
          placeholder="その他（自由記入）"
          className="mt-2"
          value={(formData.praisedExperiencesOther as string) || ""}
          onChange={(e) =>
            updateField("praisedExperiencesOther", e.target.value)
          }
        />
        <FieldError name="praisedExperiences" />
      </div>
    </div>
  );
}
