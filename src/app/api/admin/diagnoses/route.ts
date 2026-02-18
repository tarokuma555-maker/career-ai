import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredDiagnosis, DiagnosisIndexEntry } from "@/lib/agent-types";

const PAGE_SIZE = 20;
const DIAGNOSIS_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90日

function isExpired(entry: DiagnosisIndexEntry): boolean {
  return Date.now() - entry.createdAt > DIAGNOSIS_TTL_MS;
}

function parseEntry(item: unknown): DiagnosisIndexEntry {
  return typeof item === "string"
    ? (JSON.parse(item) as DiagnosisIndexEntry)
    : (item as DiagnosisIndexEntry);
}

/** 期限切れエントリを非同期で削除（fire-and-forget） */
function removeStaleEntries(rawItems: unknown[]): void {
  if (rawItems.length === 0) return;
  Promise.all(
    rawItems.map((item) => kv.lrem("career-ai:diagnosis-index", 1, item)),
  ).catch((err) => console.error("Stale cleanup error:", err));
}

/** 個別取得で404の場合、インデックスから該当エントリを削除 */
async function cleanupStaleEntry(diagnosisId: string): Promise<void> {
  const items = await kv.lrange("career-ai:diagnosis-index", 0, -1);
  for (const item of items) {
    const entry = parseEntry(item);
    if (entry.id === diagnosisId) {
      await kv.lrem("career-ai:diagnosis-index", 1, item);
      return;
    }
  }
}

// ---------- 一括削除 ----------
export async function DELETE(request: NextRequest) {
  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 },
    );
  }

  const ids = body.ids;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "削除対象のIDが指定されていません。" },
      { status: 400 },
    );
  }

  try {
    const idSet = new Set(ids);

    // 1. KV から診断データを削除
    await Promise.all(
      ids.map((id) => kv.del(`career-ai:diagnosis:${id}`)),
    );

    // 2. インデックスから該当エントリを削除
    const allItems = await kv.lrange("career-ai:diagnosis-index", 0, -1);
    const toRemove: unknown[] = [];
    for (const item of allItems) {
      const entry = parseEntry(item);
      if (idSet.has(entry.id)) {
        toRemove.push(item);
      }
    }
    await Promise.all(
      toRemove.map((item) => kv.lrem("career-ai:diagnosis-index", 1, item)),
    );

    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json(
      { error: "削除に失敗しました。" },
      { status: 500 },
    );
  }
}

// ---------- 一覧取得 / 個別取得 ----------
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  // 個別の診断データ取得
  if (id) {
    try {
      const raw = await kv.get<string>(`career-ai:diagnosis:${id}`);
      if (!raw) {
        // 期限切れの可能性 → インデックスからも非同期削除
        cleanupStaleEntry(id).catch((err) =>
          console.error("Cleanup failed:", err),
        );
        return NextResponse.json(
          { error: "診断データが見つかりません。期限切れの可能性があります。" },
          { status: 404 },
        );
      }
      const data: StoredDiagnosis =
        typeof raw === "string" ? JSON.parse(raw) : raw;
      return NextResponse.json(data);
    } catch (err) {
      console.error("KV read error:", err);
      return NextResponse.json(
        { error: "データの取得に失敗しました。" },
        { status: 500 },
      );
    }
  }

  // 一覧取得
  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get("page")) || 1,
  );
  const search = request.nextUrl.searchParams.get("search")?.trim() || "";

  try {
    if (search) {
      // 検索モード: 全件取得 → フィルタ → ページネーション
      const rawAll = await kv.lrange("career-ai:diagnosis-index", 0, -1);

      const staleRaw: unknown[] = [];
      const liveEntries: DiagnosisIndexEntry[] = [];

      for (const item of rawAll) {
        const entry = parseEntry(item);
        if (isExpired(entry)) {
          staleRaw.push(item);
        } else {
          liveEntries.push(entry);
        }
      }

      removeStaleEntries(staleRaw);

      // 名前の部分一致検索
      const searchLower = search.toLowerCase();
      const matched = liveEntries.filter((e) =>
        e.name?.toLowerCase().includes(searchLower),
      );

      const total = matched.length;
      const start = (page - 1) * PAGE_SIZE;
      const diagnoses = matched.slice(start, start + PAGE_SIZE);

      return NextResponse.json({
        diagnoses,
        total,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      });
    }

    // 通常モード: ページ単位取得 + 期限切れフィルタ
    const total = await kv.llen("career-ai:diagnosis-index");
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;
    const rawItems = await kv.lrange("career-ai:diagnosis-index", start, end);

    const staleRaw: unknown[] = [];
    const diagnoses: DiagnosisIndexEntry[] = [];

    for (const item of rawItems) {
      const entry = parseEntry(item);
      if (isExpired(entry)) {
        staleRaw.push(item);
      } else {
        diagnoses.push(entry);
      }
    }

    removeStaleEntries(staleRaw);

    const adjustedTotal = total - staleRaw.length;

    return NextResponse.json({
      diagnoses,
      total: adjustedTotal,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(adjustedTotal / PAGE_SIZE) || 1,
    });
  } catch (err) {
    console.error("KV list error:", err);
    return NextResponse.json(
      { error: "診断一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}
