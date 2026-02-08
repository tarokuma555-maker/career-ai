"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  openLineShare,
  type LineShareContext,
  type ShareUrls,
} from "@/lib/lineShare";

// ---------- LINE Icon ----------
export function LineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386a.63.63 0 0 1-.627-.629V8.108a.63.63 0 0 1 .627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016a.63.63 0 0 1-.629.631.626.626 0 0 1-.51-.262l-2.455-3.338v2.969a.63.63 0 0 1-.63.631.627.627 0 0 1-.629-.631V8.108a.627.627 0 0 1 .629-.63c.2 0 .381.095.51.262l2.455 3.333V8.108a.63.63 0 0 1 .63-.63.63.63 0 0 1 .629.63v4.771zm-5.741 0a.63.63 0 0 1-1.26 0V8.108a.631.631 0 0 1 1.26 0v4.771zm-2.451.631H4.932a.63.63 0 0 1-.627-.631V8.108a.63.63 0 0 1 1.26 0v4.141h1.754c.349 0 .63.285.63.63 0 .344-.281.631-.63.631M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

// ---------- LineShareButton ----------
interface LineShareButtonProps {
  context: LineShareContext;
  onShare?: () => Promise<ShareUrls>;
  shareUrls?: ShareUrls;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function LineShareButton({
  context,
  onShare,
  shareUrls,
  label = "エージェントに共有する",
  compact = false,
  disabled = false,
  className,
}: LineShareButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleClick = useCallback(async () => {
    if (isLoadingRef.current || disabled) return;
    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      // Get share URLs
      let urls: ShareUrls = shareUrls ?? {};
      if (onShare) {
        const resolved = await onShare();
        urls = { ...urls, ...resolved };
      }

      // Open LINE with pre-filled message
      const toast = await openLineShare(context, urls);
      setToastMessage(toast);
    } catch (err) {
      setToastMessage(
        err instanceof Error ? err.message : "共有に失敗しました"
      );
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [context, onShare, shareUrls, disabled]);

  // Compact variant: text link
  if (compact) {
    return (
      <>
        <button
          className={`flex items-center gap-1.5 text-sm text-[#06C755] hover:underline disabled:opacity-50 ${className ?? ""}`}
          onClick={handleClick}
          disabled={isLoading || disabled}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
          {label}
        </button>
        <Toast message={toastMessage} />
      </>
    );
  }

  // Default variant: green button
  return (
    <>
      <Button
        className={`w-full gap-2 text-white ${className ?? ""}`}
        style={{ backgroundColor: "#06C755" }}
        onClick={handleClick}
        disabled={isLoading || disabled}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LineIcon className="w-4 h-4" />
        )}
        {label}
      </Button>
      <Toast message={toastMessage} />
    </>
  );
}

// ---------- Internal Toast ----------
function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-lg text-sm max-w-[90vw] text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
