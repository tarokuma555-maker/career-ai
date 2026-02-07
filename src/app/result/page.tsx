import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ResultPage() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          あなたのキャリアプラン
        </h1>

        <Tabs defaultValue="plan" className="mb-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="plan">キャリアプラン</TabsTrigger>
            <TabsTrigger value="skills">推奨スキル</TabsTrigger>
            <TabsTrigger value="actions">アクション</TabsTrigger>
          </TabsList>

          <TabsContent value="plan">
            <Card>
              <CardHeader>
                <CardTitle>おすすめのキャリアパス</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  診断結果に基づいたキャリアプランがここに表示されます。
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills">
            <Card>
              <CardHeader>
                <CardTitle>身につけるべきスキル</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge>スキル例1</Badge>
                <Badge variant="secondary">スキル例2</Badge>
                <Badge variant="outline">スキル例3</Badge>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions">
            <Card>
              <CardHeader>
                <CardTitle>次のアクション</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  具体的なアクションプランがここに表示されます。
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-center gap-4">
          <Link href="/chat">
            <Button size="lg">AIに相談する</Button>
          </Link>
          <Link href="/diagnosis">
            <Button variant="outline" size="lg">
              もう一度診断する
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
