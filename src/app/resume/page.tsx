"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, ScrollText, Star, ArrowLeft, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageTransition from "@/components/PageTransition";

export default function ResumeTypePage() {
  const router = useRouter();
  const [hasDiagnosis, setHasDiagnosis] = useState(true);

  useEffect(() => {
    const data = localStorage.getItem("diagnosisData");
    setHasDiagnosis(!!data);
  }, []);

  const handleSelect = (type: string) => {
    router.push(`/resume/create?type=${type}`);
  };

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl mx-auto">
          <Link
            href="/result"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            結果に戻る
          </Link>

          {/* 診断未受検バナー */}
          {!hasDiagnosis && (
            <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium mb-1">
                    先にキャリア診断を受けると、より精度の高い自己PRを生成できます
                  </p>
                  <Link
                    href="/diagnosis"
                    className="text-sm text-primary hover:underline"
                  >
                    キャリア診断を受ける →
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2">書類を作成する</h1>
            <p className="text-muted-foreground">
              あなたの情報をもとに、転職用の書類を自動作成します
            </p>
          </div>

          {/* 個別カード */}
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <Card
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5"
              onClick={() => handleSelect("resume")}
            >
              <CardHeader className="pb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">履歴書</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  基本情報・学歴・資格をまとめた書類
                </p>
                <Button variant="outline" className="w-full">
                  作成する →
                </Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5"
              onClick={() => handleSelect("cv")}
            >
              <CardHeader className="pb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                  <ScrollText className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">職務経歴書</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  職歴の詳細・スキル・実績をアピールする書類
                </p>
                <Button variant="outline" className="w-full">
                  作成する →
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* セットカード */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5 border-primary/30 bg-primary/[0.02]"
            onClick={() => handleSelect("both")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Star className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    両方セットで作成
                    <span className="ml-2 text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      おすすめ
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    入力は1回で両方の書類が完成します
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full">セットで作成する →</Button>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <Button variant="ghost" asChild>
              <Link href="/result">キャンセル</Link>
            </Button>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}
