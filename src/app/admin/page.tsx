"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  Briefcase,
  Search,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // 削除関連
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 検索デバウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ページ移動時に選択をリセット
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, debouncedSearch]);

  const fetchDiagnoses = useCallback(async (p: number, search: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/diagnoses?${params}`);
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
    fetchDiagnoses(page, debouncedSearch);
  }, [page, debouncedSearch, fetchDiagnoses]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    const allIds = data.diagnoses.map((e) => e.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/diagnoses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "削除に失敗しました");
      }
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      fetchDiagnoses(page, debouncedSearch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const pageIds = data?.diagnoses.map((e) => e.id) ?? [];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

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
                    {debouncedSearch ? (
                      <>
                        「<span className="font-bold">{debouncedSearch}</span>」の検索結果:{" "}
                        <span className="font-bold">{data.total}</span> 件
                      </>
                    ) : (
                      <>
                        全 <span className="font-bold">{data.total}</span> 件の診断データ
                      </>
                    )}
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 検索バー */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="名前で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>

          {/* 選択時の操作バー */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 accent-red-500"
                    />
                    <span className="text-sm font-medium text-red-800">
                      {selectedIds.size}件選択中
                    </span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    削除
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                  <p className="text-muted-foreground">
                    {debouncedSearch
                      ? "該当する診断データが見つかりませんでした。"
                      : "まだ診断データがありません。"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.diagnoses.map((entry, i) => {
                    const isSelected = selectedIds.has(entry.id);
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className={`transition-colors cursor-pointer ${isSelected ? "border-red-300 bg-red-50/50" : "hover:border-primary/30"}`}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center gap-3">
                              {/* チェックボックス */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(entry.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-gray-300 accent-red-500 flex-shrink-0"
                              />
                              {/* カード内容（クリックで詳細へ） */}
                              <Link href={`/admin/result/${entry.id}`} className="flex-1 min-w-0">
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
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
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

        {/* 削除確認ダイアログ */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* オーバーレイ */}
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => !isDeleting && setShowDeleteConfirm(false)}
              />
              {/* ダイアログ */}
              <motion.div
                className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">データの削除</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedIds.size}件のデータを削除しますか？
                    </p>
                  </div>
                </div>
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  この操作は取り消せません。選択した診断データが完全に削除されます。
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    削除する
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PageTransition>
  );
}
