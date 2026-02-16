"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FOCUSED_HOBBIES,
  LONG_TERM_HOBBIES,
  TEACHABLE_SKILLS,
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

export default function StepHobbies({
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
          時間を忘れて集中できる趣味（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {FOCUSED_HOBBIES.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.focusedHobbies as string[]) || []
              ).includes(item)}
              variant={
                ((formData.focusedHobbies as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("focusedHobbies", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("focusedHobbies", item);
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
          value={(formData.focusedHobbiesOther as string) || ""}
          onChange={(e) => updateField("focusedHobbiesOther", e.target.value)}
        />
        <FieldError name="focusedHobbies" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          3年以上続けている趣味（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {LONG_TERM_HOBBIES.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.longTermHobbies as string[]) || []
              ).includes(item)}
              variant={
                ((formData.longTermHobbies as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("longTermHobbies", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("longTermHobbies", item);
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
          value={(formData.longTermHobbiesOther as string) || ""}
          onChange={(e) => updateField("longTermHobbiesOther", e.target.value)}
        />
        <FieldError name="longTermHobbies" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          人に教えられるスキル（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {TEACHABLE_SKILLS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.teachableSkills as string[]) || []
              ).includes(item)}
              variant={
                ((formData.teachableSkills as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("teachableSkills", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("teachableSkills", item);
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
          value={(formData.teachableSkillsOther as string) || ""}
          onChange={(e) => updateField("teachableSkillsOther", e.target.value)}
        />
        <FieldError name="teachableSkills" />
      </div>
    </div>
  );
}
