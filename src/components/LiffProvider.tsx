"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import liff from "@line/liff";
import {
  LIFF_ID,
  IS_LIFF_ENABLED,
  LIFF_PROFILE_KEY,
  isGatedRoute,
  type LiffUserProfile,
} from "@/lib/liff";
import LiffGateScreen from "@/components/LiffGateScreen";

interface LiffContextValue {
  isReady: boolean;
  isLoggedIn: boolean;
  isFriend: boolean;
  profile: LiffUserProfile | null;
  error: string | null;
  login: () => void;
}

const LiffContext = createContext<LiffContextValue>({
  isReady: false,
  isLoggedIn: false,
  isFriend: false,
  profile: null,
  error: null,
  login: () => {},
});

export const useLiff = () => useContext(LiffContext);

export default function LiffProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [isReady, setIsReady] = useState(!IS_LIFF_ENABLED);
  const [isLoggedIn, setIsLoggedIn] = useState(!IS_LIFF_ENABLED);
  const [isFriend, setIsFriend] = useState(!IS_LIFF_ENABLED);
  const [profile, setProfile] = useState<LiffUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // キャッシュされたプロフィールを復元
  useEffect(() => {
    if (!IS_LIFF_ENABLED) return;
    try {
      const cached = localStorage.getItem(LIFF_PROFILE_KEY);
      if (cached) setProfile(JSON.parse(cached));
    } catch {
      // ignore
    }
  }, []);

  // LIFF SDK初期化
  useEffect(() => {
    if (!IS_LIFF_ENABLED) return;

    let cancelled = false;

    async function init() {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (cancelled) return;
        setIsReady(true);

        if (!liff.isLoggedIn()) {
          setIsLoggedIn(false);
          return;
        }

        setIsLoggedIn(true);

        // 友だち状態チェック
        try {
          const friendship = await liff.getFriendship();
          if (!cancelled) setIsFriend(friendship.friendFlag);
        } catch {
          if (!cancelled) setIsFriend(false);
        }

        // プロフィール取得
        try {
          const p = await liff.getProfile();
          if (!cancelled) {
            const userProfile: LiffUserProfile = {
              userId: p.userId,
              displayName: p.displayName,
              pictureUrl: p.pictureUrl,
            };
            setProfile(userProfile);
            localStorage.setItem(LIFF_PROFILE_KEY, JSON.stringify(userProfile));
          }
        } catch {
          // プロフィール取得失敗は致命的ではない
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "LIFF初期化に失敗しました"
          );
          setIsReady(true);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    if (!IS_LIFF_ENABLED || !isReady) return;
    liff.login({ redirectUri: window.location.href });
  }, [isReady]);

  const value: LiffContextValue = {
    isReady,
    isLoggedIn,
    isFriend,
    profile,
    error,
    login,
  };

  const needsGate = IS_LIFF_ENABLED && isGatedRoute(pathname);
  const shouldShowLoading = needsGate && !isReady;
  const shouldShowGate = needsGate && isReady && (!isLoggedIn || !isFriend);

  return (
    <LiffContext.Provider value={value}>
      {shouldShowLoading ? (
        <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
          <div className="glass-card p-10 text-center max-w-md mx-auto">
            <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          </div>
        </main>
      ) : shouldShowGate ? (
        <LiffGateScreen
          isLoggedIn={isLoggedIn}
          isFriend={isFriend}
          onLogin={login}
        />
      ) : (
        children
      )}
    </LiffContext.Provider>
  );
}
