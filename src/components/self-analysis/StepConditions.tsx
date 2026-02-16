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
  DESIRED_SKILLS,
  WORK_HOURS_OPTIONS,
  DESIRED_LOCATION_OPTIONS,
  OVERTIME_VALUES,
  JOB_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  WORKPLACE_ATMOSPHERE_OPTIONS,
  DESIRED_INCOME_OPTIONS,
  CURRENT_SKILLS,
  CURRENT_LOCATION_OPTIONS,
  CURRENT_OVERTIME_OPTIONS,
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

export default function StepConditions({
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

  const desiredCompanyFame = (formData.desiredCompanyFame as number) || 0;
  const currentCompanyFame = (formData.currentCompanyFame as number) || 0;
  const currentWorkHoursFlexibility =
    (formData.currentWorkHoursFlexibility as number) || 0;

  return (
    <div className="space-y-6">
      {/* === 希望条件 === */}
      <h3 className="text-base font-semibold border-b pb-2">希望条件</h3>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          企業知名度の希望 <span className="text-destructive">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            知名度重視
          </span>
          <div className="flex gap-1 flex-1 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`w-10 h-10 rounded-full border-2 text-sm font-medium transition-colors ${
                  desiredCompanyFame === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 hover:border-primary/50"
                }`}
                onClick={() => updateField("desiredCompanyFame", n)}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ベンチャー
          </span>
        </div>
        <FieldError name="desiredCompanyFame" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          身につけたいスキル（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {DESIRED_SKILLS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.desiredSkills as string[]) || []
              ).includes(item)}
              variant={
                ((formData.desiredSkills as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("desiredSkills", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("desiredSkills", item);
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
          value={(formData.desiredSkillsOther as string) || ""}
          onChange={(e) => updateField("desiredSkillsOther", e.target.value)}
        />
        <FieldError name="desiredSkills" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            勤務時間 <span className="text-destructive">*</span>
          </label>
          <Select
            value={(formData.desiredWorkHours as string) || ""}
            onValueChange={(v) => updateField("desiredWorkHours", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {WORK_HOURS_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
              <SelectItem value="その他">その他</SelectItem>
            </SelectContent>
          </Select>
          {(formData.desiredWorkHours as string) === "その他" && (
            <Input
              placeholder="具体的に"
              className="mt-1"
              value={(formData.desiredWorkHoursOther as string) || ""}
              onChange={(e) =>
                updateField("desiredWorkHoursOther", e.target.value)
              }
            />
          )}
          <FieldError name="desiredWorkHours" />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            勤務地 <span className="text-destructive">*</span>
          </label>
          <Select
            value={(formData.desiredLocation as string) || ""}
            onValueChange={(v) => updateField("desiredLocation", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {DESIRED_LOCATION_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
              <SelectItem value="その他">その他</SelectItem>
            </SelectContent>
          </Select>
          {(formData.desiredLocation as string) === "その他" && (
            <Input
              placeholder="具体的に"
              className="mt-1"
              value={(formData.desiredLocationOther as string) || ""}
              onChange={(e) =>
                updateField("desiredLocationOther", e.target.value)
              }
            />
          )}
          <FieldError name="desiredLocation" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          残業 <span className="text-destructive">*</span>
        </label>
        <Select
          value={(formData.desiredOvertime as string) || ""}
          onValueChange={(v) => updateField("desiredOvertime", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {OVERTIME_VALUES.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError name="desiredOvertime" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          希望職種（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPE_OPTIONS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.desiredJobTypes as string[]) || []
              ).includes(item)}
              variant={
                ((formData.desiredJobTypes as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("desiredJobTypes", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("desiredJobTypes", item);
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
          value={(formData.desiredJobTypesOther as string) || ""}
          onChange={(e) => updateField("desiredJobTypesOther", e.target.value)}
        />
        <FieldError name="desiredJobTypes" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          希望業種（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_OPTIONS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.desiredIndustries as string[]) || []
              ).includes(item)}
              variant={
                ((formData.desiredIndustries as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("desiredIndustries", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("desiredIndustries", item);
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
          value={(formData.desiredIndustriesOther as string) || ""}
          onChange={(e) =>
            updateField("desiredIndustriesOther", e.target.value)
          }
        />
        <FieldError name="desiredIndustries" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          希望の職場雰囲気 <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {WORKPLACE_ATMOSPHERE_OPTIONS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={formData.desiredAtmosphere === item}
              variant={
                formData.desiredAtmosphere === item ? "default" : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => updateField("desiredAtmosphere", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  updateField("desiredAtmosphere", item);
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
          value={(formData.desiredAtmosphereOther as string) || ""}
          onChange={(e) =>
            updateField("desiredAtmosphereOther", e.target.value)
          }
        />
        <FieldError name="desiredAtmosphere" />
      </div>

      {/* === 現在の状況 === */}
      <h3 className="text-base font-semibold border-b pb-2 mt-8">
        現在の状況
      </h3>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          現在の年収 <span className="text-destructive">*</span>
        </label>
        <Select
          value={(formData.currentIncome as string) || ""}
          onValueChange={(v) => updateField("currentIncome", v)}
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
        {(formData.currentIncome as string) === "その他" && (
          <Input
            placeholder="具体的に"
            className="mt-1"
            value={(formData.currentIncomeOther as string) || ""}
            onChange={(e) => updateField("currentIncomeOther", e.target.value)}
          />
        )}
        <FieldError name="currentIncome" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          現在の企業知名度 <span className="text-destructive">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            知名度高い
          </span>
          <div className="flex gap-1 flex-1 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`w-10 h-10 rounded-full border-2 text-sm font-medium transition-colors ${
                  currentCompanyFame === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 hover:border-primary/50"
                }`}
                onClick={() => updateField("currentCompanyFame", n)}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            知名度低い
          </span>
        </div>
        <FieldError name="currentCompanyFame" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          持っているスキル（複数選択OK）{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CURRENT_SKILLS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={(
                (formData.currentSkills as string[]) || []
              ).includes(item)}
              variant={
                ((formData.currentSkills as string[]) || []).includes(item)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleArrayItem("currentSkills", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleArrayItem("currentSkills", item);
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
          value={(formData.currentSkillsOther as string) || ""}
          onChange={(e) => updateField("currentSkillsOther", e.target.value)}
        />
        <FieldError name="currentSkills" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          勤務時間の融通 <span className="text-destructive">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            融通利く
          </span>
          <div className="flex gap-1 flex-1 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`w-10 h-10 rounded-full border-2 text-sm font-medium transition-colors ${
                  currentWorkHoursFlexibility === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 hover:border-primary/50"
                }`}
                onClick={() => updateField("currentWorkHoursFlexibility", n)}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            利かない
          </span>
        </div>
        <FieldError name="currentWorkHoursFlexibility" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            勤務地 <span className="text-destructive">*</span>
          </label>
          <Select
            value={(formData.currentLocation as string) || ""}
            onValueChange={(v) => updateField("currentLocation", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {CURRENT_LOCATION_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
              <SelectItem value="その他">その他</SelectItem>
            </SelectContent>
          </Select>
          {(formData.currentLocation as string) === "その他" && (
            <Input
              placeholder="具体的に"
              className="mt-1"
              value={(formData.currentLocationOther as string) || ""}
              onChange={(e) =>
                updateField("currentLocationOther", e.target.value)
              }
            />
          )}
          <FieldError name="currentLocation" />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            残業 <span className="text-destructive">*</span>
          </label>
          <Select
            value={(formData.currentOvertime as string) || ""}
            onValueChange={(v) => updateField("currentOvertime", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {CURRENT_OVERTIME_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError name="currentOvertime" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            職種 <span className="text-destructive">*</span>
          </label>
          <Select
            value={(formData.currentJobType as string) || ""}
            onValueChange={(v) => updateField("currentJobType", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {JOB_TYPE_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
              <SelectItem value="その他">その他</SelectItem>
            </SelectContent>
          </Select>
          {(formData.currentJobType as string) === "その他" && (
            <Input
              placeholder="具体的に"
              className="mt-1"
              value={(formData.currentJobTypeOther as string) || ""}
              onChange={(e) =>
                updateField("currentJobTypeOther", e.target.value)
              }
            />
          )}
          <FieldError name="currentJobType" />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            業種 <span className="text-destructive">*</span>
          </label>
          <Select
            value={(formData.currentIndustry as string) || ""}
            onValueChange={(v) => updateField("currentIndustry", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
              <SelectItem value="その他">その他</SelectItem>
            </SelectContent>
          </Select>
          {(formData.currentIndustry as string) === "その他" && (
            <Input
              placeholder="具体的に"
              className="mt-1"
              value={(formData.currentIndustryOther as string) || ""}
              onChange={(e) =>
                updateField("currentIndustryOther", e.target.value)
              }
            />
          )}
          <FieldError name="currentIndustry" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">
          現在の職場雰囲気 <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {WORKPLACE_ATMOSPHERE_OPTIONS.map((item) => (
            <Badge
              key={item}
              role="button"
              tabIndex={0}
              aria-pressed={formData.currentAtmosphere === item}
              variant={
                formData.currentAtmosphere === item ? "default" : "outline"
              }
              className="cursor-pointer select-none transition-colors"
              onClick={() => updateField("currentAtmosphere", item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  updateField("currentAtmosphere", item);
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
          value={(formData.currentAtmosphereOther as string) || ""}
          onChange={(e) =>
            updateField("currentAtmosphereOther", e.target.value)
          }
        />
        <FieldError name="currentAtmosphere" />
      </div>
    </div>
  );
}
