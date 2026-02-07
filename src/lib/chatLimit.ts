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
