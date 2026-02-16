import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredDiagnosis, DiagnosisIndexEntry } from "@/lib/agent-types";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  // 個別の診断データ取得
  if (id) {
    try {
      const raw = await kv.get<string>(`career-ai:diagnosis:${id}`);
      if (!raw) {
        return NextResponse.json(
          { error: "診断データが見つかりません。" },
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
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  try {
    const total = await kv.llen("career-ai:diagnosis-index");
    const rawItems = await kv.lrange("career-ai:diagnosis-index", start, end);

    const diagnoses: DiagnosisIndexEntry[] = rawItems.map((item) => {
      if (typeof item === "string") {
        return JSON.parse(item) as DiagnosisIndexEntry;
      }
      return item as DiagnosisIndexEntry;
    });

    return NextResponse.json({
      diagnoses,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    console.error("KV list error:", err);
    return NextResponse.json(
      { error: "診断一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}
