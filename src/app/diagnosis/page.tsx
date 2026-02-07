"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const steps = ["基本情報", "スキル・経験", "希望・目標"];

export default function DiagnosisPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push("/analyzing");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-2">
            ステップ {currentStep + 1} / {steps.length}: {steps[currentStep]}
          </p>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStep === 0 && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">年齢</label>
                  <Input type="number" placeholder="例: 28" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">現在の職種</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineer">エンジニア</SelectItem>
                      <SelectItem value="designer">デザイナー</SelectItem>
                      <SelectItem value="marketing">マーケティング</SelectItem>
                      <SelectItem value="sales">営業</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {currentStep === 1 && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">経験年数</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-1">1年未満</SelectItem>
                      <SelectItem value="1-3">1〜3年</SelectItem>
                      <SelectItem value="3-5">3〜5年</SelectItem>
                      <SelectItem value="5-10">5〜10年</SelectItem>
                      <SelectItem value="10+">10年以上</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">得意なスキル</label>
                  <Textarea placeholder="例: JavaScript, プロジェクト管理, データ分析..." />
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">キャリアの目標</label>
                  <Textarea placeholder="例: マネジメント職に就きたい、フリーランスになりたい..." />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">興味のある分野</label>
                  <Input placeholder="例: AI, Web開発, データサイエンス..." />
                </div>
              </>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                戻る
              </Button>
              <Button onClick={handleNext}>
                {currentStep === steps.length - 1 ? "診断する" : "次へ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
