"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  APPRECIATED_EXPERIENCES,
  SURVIVAL_SCENARIOS,
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

export default function StepExperience({
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
          感謝された経験（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {APPRECIATED_EXPERIENCES.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.appreciatedExperiences as string[]) || []
              ).includes(item)}
              variant={
                ((formData.appreciatedExperiences as string[]) || []).includes(
                  item,
                )
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("appreciatedExperiences", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("appreciatedExperiences", item);
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
          value={(formData.appreciatedExperiencesOther as string) || ""}
          onChange={(e) =>
            updateField("appreciatedExperiencesOther", e.target.value)
          }
        />
        <FieldError name="appreciatedExperiences" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          もし遭難したら、まず何をしますか？{" "}
          <span className="text-destructive">*</span>
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          1つだけ選んでください
        </p>
        <div className="flex flex-wrap gap-2">
          {SURVIVAL_SCENARIOS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={formData.survivalScenario === item}
              variant={
                formData.survivalScenario === item ? "default" : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => updateField("survivalScenario", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  updateField("survivalScenario", item);
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
          value={(formData.survivalScenarioOther as string) || ""}
          onChange={(e) =>
            updateField("survivalScenarioOther", e.target.value)
          }
        />
        <FieldError name="survivalScenario" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          上の選択の理由 <span className="text-destructive">*</span>
        </label>
        <Textarea
          placeholder="なぜその行動を選んだか教えてください"
          value={(formData.survivalScenarioReason as string) || ""}
          onChange={(e) =>
            updateField("survivalScenarioReason", e.target.value)
          }
          rows={3}
        />
        <FieldError name="survivalScenarioReason" />
      </div>
    </div>
  );
}
