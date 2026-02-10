"use client";

import { Button } from "@/components/ui/button";
import { LineIcon } from "@/components/LineShareButton";
import { LINE_ADD_FRIEND_URL } from "@/lib/liff";
import PageTransition from "@/components/PageTransition";

interface LiffGateScreenProps {
  isLoggedIn: boolean;
  isFriend: boolean;
  onLogin: () => void;
}

export default function LiffGateScreen({
  isLoggedIn,
  onLogin,
}: LiffGateScreenProps) {
  // 未ログイン
  if (!isLoggedIn) {
    return (
      <PageTransition>
        <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
          <div className="glass-card p-10 sm:p-16 text-center max-w-md mx-auto space-y-6">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#06C755" }}
            >
              <LineIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-heading text-2xl font-bold">
              LINEでログイン
            </h1>
            <p className="text-sm text-muted-foreground">
              Career AIの全機能を利用するには、LINEアカウントでログインしてください。
            </p>
            <Button
              size="lg"
              className="w-full gap-2 text-white text-base py-6"
              style={{ backgroundColor: "#06C755" }}
              onClick={onLogin}
            >
              <LineIcon className="w-5 h-5" />
              LINEでログイン
            </Button>
          </div>
        </main>
      </PageTransition>
    );
  }

  // ログイン済み・未友だち
  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="glass-card p-10 sm:p-16 text-center max-w-md mx-auto space-y-6">
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#06C755" }}
          >
            <LineIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-heading text-2xl font-bold">
            友だち追加で始めよう
          </h1>
          <p className="text-sm text-muted-foreground">
            Career AIの機能を利用するには、LINE公式アカウントを友だち追加してください。
            追加後、下の「再読み込み」ボタンを押してください。
          </p>
          <a
            href={LINE_ADD_FRIEND_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="lg"
              className="w-full gap-2 text-white text-base py-6"
              style={{ backgroundColor: "#06C755" }}
            >
              <LineIcon className="w-5 h-5" />
              友だち追加する
            </Button>
          </a>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            追加済みの方はこちら（再読み込み）
          </Button>
        </div>
      </main>
    </PageTransition>
  );
}
