export interface DetailedLifePlan {
  personalProfile: {
    summary: string;
    coreStrengths: string[];
    personalityType: string;
    workStyle: string;
  };
  careerStrategy: {
    shortTerm: { period: string; goals: string[]; actions: string[] };
    midTerm: { period: string; goals: string[]; actions: string[] };
    longTerm: { period: string; goals: string[]; actions: string[] };
  };
  lifePlan: {
    financialPlan: string;
    familyPlan: string;
    lifestyleAdvice: string;
    balanceStrategy: string;
  };
  gapAnalysis: {
    currentVsDesired: {
      area: string;
      current: string;
      desired: string;
      action: string;
    }[];
  };
  detailedRecommendations: {
    jobRecommendations: {
      title: string;
      reason: string;
      salary: string;
      fit: number;
    }[];
    skillDevelopment: {
      skill: string;
      method: string;
      timeline: string;
    }[];
    networkingAdvice: string;
  };
  agentTalkingPoints: string[];
  overallSummary: string;
}
