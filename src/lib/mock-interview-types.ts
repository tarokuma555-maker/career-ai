export type InterviewType = "first" | "second" | "final";

export interface MockInterviewSettings {
  industry: string;
  position: string;
  interviewType: InterviewType;
  questionCount: 5 | 8;
}

export interface InterviewerProfile {
  name: string;
  role: string;
}

export interface MockQuestion {
  id: number;
  question: string;
  category: string;
  intent: string;
  followUpHints: string[];
}

export interface AnswerEvaluation {
  score: number;
  goodPoints: string[];
  improvementPoints: string[];
  detailScores: {
    relevance: number;
    specificity: number;
    logic: number;
    enthusiasm: number;
  };
  shortFeedback: string;
}

export interface MockAnswer {
  questionIndex: number;
  question: string;
  answer: string;
  answerDuration: number;
  evaluation: AnswerEvaluation;
  answeredAt: string;
}

export interface MockInterviewSession {
  sessionId: string;
  settings: MockInterviewSettings;
  interviewerProfile: InterviewerProfile;
  openingMessage: string;
  questions: MockQuestion[];
  answers: MockAnswer[];
  status: "in-progress" | "completed";
  startedAt: string;
  completedAt?: string;
  summary?: MockInterviewSummary;
}

export interface MockInterviewSummary {
  totalScore: number;
  grade: string;
  passLikelihood: string;
  overallScores: {
    content: number;
    logic: number;
    communication: number;
    understanding: number;
    enthusiasm: number;
  };
  strengths: string[];
  improvements: string[];
  overallFeedback: string;
  nextSteps: string[];
}
