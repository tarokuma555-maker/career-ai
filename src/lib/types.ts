export interface CareerPath {
  title: string;
  match_score: number;
  salary_range: { min: number; max: number; unit: string };
  description: string;
  why_recommended: string;
  roadmap: { step: number; period: string; action: string }[];
  required_skills: string[];
  pros: string[];
  cons: string[];
  risks: string;
}

export interface SkillAnalysis {
  current_skills: Record<string, number>;
  target_skills: Record<string, number>;
}

export interface AnalysisResult {
  career_paths: CareerPath[];
  skill_analysis: SkillAnalysis;
  overall_advice: string;
}
