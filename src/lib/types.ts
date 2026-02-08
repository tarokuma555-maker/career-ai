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

export interface InterviewQuestion {
  id: number;
  question: string;
}

export interface InterviewReview {
  question: string;
  original_answer: string;
  improved_answer: string;
  score: number;
  feedback: string;
}

export interface InterviewResult {
  reviews: InterviewReview[];
  overall_score: number;
  overall_advice: string;
}

// ---------- リッチ添削結果 ----------
export interface ReviewScoreBreakdownItem {
  score: number;
  label: string;
}

export interface ReviewScore {
  total: number;
  breakdown: {
    content: ReviewScoreBreakdownItem;
    structure: ReviewScoreBreakdownItem;
    specificity: ReviewScoreBreakdownItem;
    impression: ReviewScoreBreakdownItem;
  };
  grade: string;
  summary: string;
}

export interface ReviewChange {
  type: "added" | "improved" | "removed";
  description: string;
}

export interface ReviewImprovementPoint {
  issue: string;
  suggestion: string;
}

export interface ReviewData {
  score: ReviewScore;
  improvedAnswer: string;
  changes: ReviewChange[];
  goodPoints: string[];
  improvementPoints: ReviewImprovementPoint[];
  interviewerPerspective: string[];
}

export interface RichInterviewResult {
  reviews: {
    question: string;
    userAnswer: string;
    reviewData: ReviewData;
  }[];
}
