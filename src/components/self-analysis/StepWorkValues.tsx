"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { WORK_VALUES, WORK_MEANINGS } from "@/lib/self-analysis-schema";
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

export default function StepWorkValues({
  formData,
  updateField,
  errors,
}: StepProps) {
  const FieldError = ({ name }: { name: string }) =>
    errors[name] ? (
      <p role="alert" className="text-sm text-destructive mt-1">
        {errors[name]}
      </p>
    ) : null;

  const selectedValues = [
    (formData.workValue1 as string) || "",
    (formData.workValue2 as string) || "",
    (formData.workValue3 as string) || "",
  ];

  const selectedMeanings = [
    (formData.workMeaning1 as string) || "",
    (formData.workMeaning2 as string) || "",
    (formData.workMeaning3 as string) || "",
  ];

  const getAvailableValues = (rank: number) =>
    WORK_VALUES.filter(
      (v) => !selectedValues.includes(v) || selectedValues[rank] === v,
    );

  const getAvailableMeanings = (rank: number) =>
    WORK_MEANINGS.filter(
      (v) => !selectedMeanings.includes(v) || selectedMeanings[rank] === v,
    );

  const valueKeys: (keyof SelfAnalysisData)[] = [
    "workValue1",
    "workValue2",
    "workValue3",
  ];
  const valueOtherKeys: (keyof SelfAnalysisData)[] = [
    "workValue1Other",
    "workValue2Other",
    "workValue3Other",
  ];
  const meaningKeys: (keyof SelfAnalysisData)[] = [
    "workMeaning1",
    "workMeaning2",
    "workMeaning3",
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium mb-3 block">
          仕事で大切にしたいことTOP3{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={`value-${i}`}>
              <label className="text-xs text-muted-foreground mb-1 block">
                {i + 1}位
              </label>
              <Select
                value={(formData[valueKeys[i]] as string) || ""}
                onValueChange={(v) => updateField(valueKeys[i], v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableValues(i).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                  <SelectItem value="その他">その他</SelectItem>
                </SelectContent>
              </Select>
              {(formData[valueKeys[i]] as string) === "その他" && (
                <Input
                  placeholder="具体的に入力"
                  className="mt-1"
                  value={(formData[valueOtherKeys[i]] as string) || ""}
                  onChange={(e) =>
                    updateField(valueOtherKeys[i], e.target.value)
                  }
                />
              )}
              <FieldError name={valueKeys[i] as string} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-3 block">
          あなたにとって「働く」とはTOP3{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={`meaning-${i}`}>
              <label className="text-xs text-muted-foreground mb-1 block">
                {i + 1}位
              </label>
              <Select
                value={(formData[meaningKeys[i]] as string) || ""}
                onValueChange={(v) => updateField(meaningKeys[i], v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableMeanings(i).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError name={meaningKeys[i] as string} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
