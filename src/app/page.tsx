import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Career AI
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-8">
          AIがあなたに最適なキャリアプランを提案します
        </p>
        <Link href="/diagnosis">
          <Button size="lg" className="text-base px-8 py-6">
            無料でキャリア診断を始める
          </Button>
        </Link>
      </div>
    </main>
  );
}
