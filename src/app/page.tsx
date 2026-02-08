"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import PageTransition from "@/components/PageTransition";
import TypingText from "@/components/TypingText";

export default function Home() {
  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="glass-card p-10 sm:p-16 text-center max-w-2xl mx-auto">
          <h1 className="font-heading text-5xl sm:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-accent-gradient bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
              Career AI
            </span>
          </h1>
          <TypingText
            text="AIがあなたに最適なキャリアプランを提案します"
            speed={40}
            delay={600}
            className="text-lg sm:text-xl text-muted-foreground block mb-10"
            as="p"
          />
          <Link href="/diagnosis">
            <Button
              size="lg"
              className="text-base px-10 py-7 rounded-2xl animate-pulse-glow"
            >
              無料でキャリア診断を始める
            </Button>
          </Link>
        </div>
      </main>
    </PageTransition>
  );
}
