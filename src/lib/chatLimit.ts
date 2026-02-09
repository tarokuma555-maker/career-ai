const FREE_CHAT_LIMIT = 3;
const STORAGE_KEY = "career-ai-chat-usage";

type ChatUsage = {
  count: number;
  isPremium: boolean;
};

export function getChatUsage(): ChatUsage {
  if (typeof window === "undefined") {
    return { count: 0, isPremium: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, isPremium: false };
    return JSON.parse(raw) as ChatUsage;
  } catch {
    return { count: 0, isPremium: false };
  }
}

export function incrementChatCount(): {
  allowed: boolean;
  remaining: number;
} {
  const usage = getChatUsage();
  usage.count += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));

  if (usage.isPremium) {
    return { allowed: true, remaining: Infinity };
  }

  const remaining = Math.max(FREE_CHAT_LIMIT - usage.count, 0);
  return {
    allowed: usage.count <= FREE_CHAT_LIMIT,
    remaining,
  };
}

export function getRemainingChats(): number {
  const usage = getChatUsage();
  if (usage.isPremium) return Infinity;
  return Math.max(FREE_CHAT_LIMIT - usage.count, 0);
}

export function setPremium(): void {
  const usage = getChatUsage();
  usage.isPremium = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
}

export function resetChatCount(): void {
  const usage = getChatUsage();
  usage.count = 0;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
}

// ---------- 面接AI添削の利用回数管理（月1回無料） ----------
const INTERVIEW_STORAGE_KEY = "career-ai-interview-usage";
const FREE_INTERVIEW_LIMIT = 1;

type InterviewUsage = {
  count: number;
  month: string; // "YYYY-MM" 形式
  isPremium: boolean;
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getInterviewUsage(): InterviewUsage {
  if (typeof window === "undefined") {
    return { count: 0, month: currentMonth(), isPremium: false };
  }
  try {
    const raw = localStorage.getItem(INTERVIEW_STORAGE_KEY);
    if (!raw) return { count: 0, month: currentMonth(), isPremium: false };
    const usage = JSON.parse(raw) as InterviewUsage;
    // 月が変わったらリセット
    if (usage.month !== currentMonth()) {
      return { count: 0, month: currentMonth(), isPremium: usage.isPremium };
    }
    return usage;
  } catch {
    return { count: 0, month: currentMonth(), isPremium: false };
  }
}

export function canUseInterviewReview(): boolean {
  const usage = getInterviewUsage();
  if (usage.isPremium) return true;
  return usage.count < FREE_INTERVIEW_LIMIT;
}

export function getInterviewRemaining(): number {
  const usage = getInterviewUsage();
  if (usage.isPremium) return Infinity;
  return Math.max(FREE_INTERVIEW_LIMIT - usage.count, 0);
}

export function incrementInterviewReview(): {
  allowed: boolean;
  remaining: number;
} {
  const usage = getInterviewUsage();
  usage.count += 1;
  usage.month = currentMonth();
  localStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(usage));

  if (usage.isPremium) {
    return { allowed: true, remaining: Infinity };
  }

  const remaining = Math.max(FREE_INTERVIEW_LIMIT - usage.count, 0);
  return {
    allowed: usage.count <= FREE_INTERVIEW_LIMIT,
    remaining,
  };
}

// ---------- AI模擬面接の利用回数管理（月1回無料） ----------
const MOCK_INTERVIEW_KEY = "career-ai-mock-interview-usage";
const FREE_MOCK_INTERVIEW_LIMIT = 1;

type MockInterviewUsage = {
  count: number;
  month: string;
  isPremium: boolean;
};

export function getMockInterviewUsage(): MockInterviewUsage {
  if (typeof window === "undefined") {
    return { count: 0, month: currentMonth(), isPremium: false };
  }
  try {
    const raw = localStorage.getItem(MOCK_INTERVIEW_KEY);
    if (!raw) return { count: 0, month: currentMonth(), isPremium: false };
    const usage = JSON.parse(raw) as MockInterviewUsage;
    if (usage.month !== currentMonth()) {
      return { count: 0, month: currentMonth(), isPremium: usage.isPremium };
    }
    return usage;
  } catch {
    return { count: 0, month: currentMonth(), isPremium: false };
  }
}

export function canUseMockInterview(): boolean {
  const usage = getMockInterviewUsage();
  if (usage.isPremium) return true;
  return usage.count < FREE_MOCK_INTERVIEW_LIMIT;
}

export function getMockInterviewRemaining(): number {
  const usage = getMockInterviewUsage();
  if (usage.isPremium) return Infinity;
  return Math.max(FREE_MOCK_INTERVIEW_LIMIT - usage.count, 0);
}

export function incrementMockInterview(): {
  allowed: boolean;
  remaining: number;
} {
  const usage = getMockInterviewUsage();
  usage.count += 1;
  usage.month = currentMonth();
  localStorage.setItem(MOCK_INTERVIEW_KEY, JSON.stringify(usage));

  if (usage.isPremium) {
    return { allowed: true, remaining: Infinity };
  }

  const remaining = Math.max(FREE_MOCK_INTERVIEW_LIMIT - usage.count, 0);
  return {
    allowed: usage.count <= FREE_MOCK_INTERVIEW_LIMIT,
    remaining,
  };
}
