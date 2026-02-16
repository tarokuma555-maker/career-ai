import type { DiagnosisData } from "./diagnosis-schema";
import type { AnalysisResult } from "./types";
import type { SelfAnalysisData } from "./self-analysis-schema";
import type { DetailedLifePlan } from "./self-analysis-types";

export interface AgentCareerPlan {
  title: string;
  match_score: number;
  salary_range: {
    min: number;
    max: number;
    unit: string;
    market_average: number;
  };
  detailed_description: string;
  why_recommended: string;
  roadmap: { step: number; period: string; action: string; detail: string }[];
  required_skills: string[];
  skill_development_plan: string;
  pros: string[];
  cons: string[];
  risks: string;
  specific_recommendations: string[];
  transition_difficulty: "easy" | "moderate" | "challenging";
}

export interface SkillGapDetail {
  skill_name: string;
  current_level: number;
  target_level: number;
  gap: number;
  priority: "high" | "medium" | "low";
  improvement_method: string;
  estimated_time: string;
}

export interface MarketInsight {
  industry_trend: string;
  demand_level: string;
  competition_level: string;
  future_outlook: string;
  recommended_timing: string;
}

export interface SalaryNegotiationAdvice {
  current_market_range: { min: number; max: number };
  negotiation_points: string[];
  leverage_factors: string[];
  timing_advice: string;
}

export interface InterviewPrepAdvice {
  key_questions: string[];
  talking_points: string[];
  potential_concerns: string[];
  presentation_tips: string[];
}

export interface RedFlag {
  flag: string;
  severity: "high" | "medium" | "low";
  mitigation: string;
}

export interface AgentAnalysisResult {
  detailed_career_plans: AgentCareerPlan[];
  skill_gap_analysis: SkillGapDetail[];
  market_insights: MarketInsight;
  salary_negotiation: SalaryNegotiationAdvice;
  interview_preparation: InterviewPrepAdvice;
  red_flags: RedFlag[];
  agent_summary: string;
}

export interface StoredDiagnosis {
  diagnosisData: DiagnosisData;
  analysisResult: AnalysisResult;
  agentAnalysis?: AgentAnalysisResult;
  selfAnalysis?: SelfAnalysisData;
  selfAnalysisAt?: number;
  detailedPlan?: DetailedLifePlan;
  createdAt: number;
}

export interface DiagnosisIndexEntry {
  id: string;
  createdAt: number;
  name: string;
  ageRange: string;
  jobType: string;
  employmentStatus: string;
}
