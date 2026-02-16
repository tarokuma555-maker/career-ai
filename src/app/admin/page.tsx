"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageTransition from "@/components/PageTransition";
import type { DiagnosisIndexEntry } from "@/lib/agent-types";

interface DiagnosisListResponse {
  diagnoses: DiagnosisIndexEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DiagnosisListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchDiagnoses = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/diagnoses?page=${p}`);
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDiagnoses(page);
  }, [page, fetchDiagnoses]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <PageTransition>
      <main className="relative z-10 min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* ヘッダー */}
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <h1 className="text-2xl font-bold font-heading bg-accent-gradient bg-clip-text text-transparent">
                エージェント管理画面
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                診断結果の一覧と詳細分析
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="w-4 h-4" />
              ログアウト
            </Button>
          </motion.div>

          {/* 統計 */}
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-sm">
                    全 <span className="font-bold">{data.total}</span> 件の診断データ
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ローディング */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="text-center py-12">
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 inline-block">
                {error}
              </p>
            </div>
          )}

          {/* 診断一覧 */}
          {data && !isLoading && (
            <>
              {data.diagnoses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">まだ診断データがありません。</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.diagnoses.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link href={`/admin/result/${entry.id}`}>
                        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0 space-y-2">
                                <p className="font-medium text-sm">{entry.name || "名前未登録"}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="secondary" className="gap-1">
                                    <Briefcase className="w-3 h-3" />
                                    {entry.jobType}
                                  </Badge>
                                  <Badge variant="outline">{entry.employmentStatus}</Badge>
                                  <Badge variant="outline">{entry.ageRange}</Badge>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(entry.createdAt)}
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* ページネーション */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </PageTransition>
  );
}
