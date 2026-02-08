"use client";

import { motion } from "framer-motion";

interface AIThinkingProps {
  text?: string;
}

export default function AIThinking({
  text = "AIが分析しています...",
}: AIThinkingProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Pulse ring */}
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: "var(--accent-gradient)", opacity: 0.15 }}
          animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.2, 0.05, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Dots */}
        <div className="relative flex items-center justify-center gap-2 w-20 h-20">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full"
              style={{
                background:
                  i === 0
                    ? "#4F46E5"
                    : i === 1
                      ? "#2563EB"
                      : "#06B6D4",
              }}
              animate={{ y: [0, -10, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
      {text && (
        <p className="text-sm text-muted-foreground font-medium">{text}</p>
      )}
    </div>
  );
}
