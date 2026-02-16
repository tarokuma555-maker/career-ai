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
  MARRIAGE_OPTIONS,
  CHILDREN_OPTIONS,
  RENT_OPTIONS,
  PRIORITY_OPTIONS,
  DESIRED_INCOME_OPTIONS,
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

export default function StepLifePlan({
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

  const workDedication = (formData.workDedication as number) || 0;

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          10年後の結婚について <span className="text-destructive">*</span>
        </label>
        <Select
          value={(formData.marriage as string) || ""}
          onValueChange={(v) => updateField("marriage", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {MARRIAGE_OPTIONS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError name="marriage" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          10年後の子どもについて <span className="text-destructive">*</span>
        </label>
        <Select
          value={(formData.children as string) || ""}
          onValueChange={(v) => updateField("children", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {CHILDREN_OPTIONS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
            <SelectItem value="その他">その他</SelectItem>
          </SelectContent>
        </Select>
        {(formData.children as string) === "その他" && (
          <Input
            placeholder="具体的に入力"
            className="mt-1"
            value={(formData.childrenOther as string) || ""}
            onChange={(e) => updateField("childrenOther", e.target.value)}
          />
        )}
        <FieldError name="children" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          10年後の家賃 <span className="text-destructive">*</span>
        </label>
        <Select
          value={(formData.rent as string) || ""}
          onValueChange={(v) => updateField("rent", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {RENT_OPTIONS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
            <SelectItem value="その他">その他</SelectItem>
          </SelectContent>
        </Select>
        {(formData.rent as string) === "その他" && (
          <Input
            placeholder="具体的に入力"
            className="mt-1"
            value={(formData.rentOther as string) || ""}
            onChange={(e) => updateField("rentOther", e.target.value)}
          />
        )}
        <FieldError name="rent" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          一番大事にしたいこと <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_OPTIONS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={formData.priority === item}
              variant={formData.priority === item ? "default" : "outline"}
              className="cursor-pointer select-none transition-colors"
              onClick={() => updateField("priority", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  updateField("priority", item);
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
          value={(formData.priorityOther as string) || ""}
          onChange={(e) => updateField("priorityOther", e.target.value)}
        />
        <FieldError name="priority" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          仕事一筋度 <span className="text-destructive">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            仕事一筋
          </span>
          <div className="flex gap-1 flex-1 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`w-10 h-10 rounded-full border-2 text-sm font-medium transition-colors ${
                  workDedication === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 hover:border-primary/50"
                }`}
                onClick={() => updateField("workDedication", n)}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            それ以外
          </span>
        </div>
        <FieldError name="workDedication" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          希望年収 <span className="text-destructive">*</span>
        </label>
        <Select
          value={(formData.desiredIncome as string) || ""}
          onValueChange={(v) => updateField("desiredIncome", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {DESIRED_INCOME_OPTIONS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
            <SelectItem value="その他">その他</SelectItem>
          </SelectContent>
        </Select>
        {(formData.desiredIncome as string) === "その他" && (
          <Input
            placeholder="具体的に入力"
            className="mt-1"
            value={(formData.desiredIncomeOther as string) || ""}
            onChange={(e) => updateField("desiredIncomeOther", e.target.value)}
          />
        )}
        <FieldError name="desiredIncome" />
      </div>
    </div>
  );
}
