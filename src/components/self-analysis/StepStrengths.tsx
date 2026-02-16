"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  STRENGTH_OPTIONS,
  IMPROVEMENT_OPTIONS,
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

export default function StepStrengths({
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

  const improvementKeys: (keyof SelfAnalysisData)[] = [
    "improvement1",
    "improvement2",
    "improvement3",
    "improvement4",
    "improvement5",
  ];
  const improvementOtherKeys: (keyof SelfAnalysisData)[] = [
    "improvement1Other",
    "improvement2Other",
    "improvement3Other",
    "improvement4Other",
    "improvement5Other",
  ];

  const selectedImprovements = improvementKeys.map(
    (k) => (formData[k] as string) || "",
  );

  const getAvailableImprovements = (rank: number) =>
    IMPROVEMENT_OPTIONS.filter(
      (v) =>
        !selectedImprovements.includes(v) || selectedImprovements[rank] === v,
    );

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          自分の強み（複数選択OK）
        </label>
        <div className="flex flex-wrap gap-2">
          {STRENGTH_OPTIONS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.strengths as string[]) || []
              ).includes(item)}
              variant={
                ((formData.strengths as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("strengths", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("strengths", item);
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
          value={(formData.strengthsOther as string) || ""}
          onChange={(e) => updateField("strengthsOther", e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-3 block">
          転職で改善したいことTOP5{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={`improvement-${i}`}>
              <label className="text-xs text-muted-foreground mb-1 block">
                {i + 1}位
              </label>
              <Select
                value={(formData[improvementKeys[i]] as string) || ""}
                onValueChange={(v) => updateField(improvementKeys[i], v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableImprovements(i).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                  <SelectItem value="その他">その他</SelectItem>
                </SelectContent>
              </Select>
              {(formData[improvementKeys[i]] as string) === "その他" && (
                <Input
                  placeholder="具体的に入力"
                  className="mt-1"
                  value={
                    (formData[improvementOtherKeys[i]] as string) || ""
                  }
                  onChange={(e) =>
                    updateField(improvementOtherKeys[i], e.target.value)
                  }
                />
              )}
              <FieldError name={improvementKeys[i] as string} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
