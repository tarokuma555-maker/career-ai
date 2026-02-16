"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import PageTransition from "@/components/PageTransition";

export default function SelfAnalysisCompletePage() {
  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.1,
              }}
              className="flex justify-center"
            >
              <CheckCircle2 className="w-20 h-20 text-green-500" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <h1 className="text-2xl font-bold">回答ありがとうございました</h1>
              <p className="text-muted-foreground">
                自己分析アンケートの回答が完了しました。
                <br />
                担当エージェントがあなたの回答をもとに
                <br />
                より詳しいキャリアプランを作成します。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link href="/">
                <Button variant="outline" className="mt-2">
                  トップに戻る
                </Button>
              </Link>
            </motion.div>
          </CardContent>
        </Card>
      </main>
    </PageTransition>
  );
}
