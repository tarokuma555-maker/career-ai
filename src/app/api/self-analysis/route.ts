import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { StoredDiagnosis } from "@/lib/agent-types";
import type { SelfAnalysisData } from "@/lib/self-analysis-schema";

export async function POST(request: NextRequest) {
  let body: { diagnosisId?: string; answers?: SelfAnalysisData };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.diagnosisId) {
    return NextResponse.json(
      { error: "診断IDが指定されていません。" },
      { status: 400 },
    );
  }

  if (!body.answers) {
    return NextResponse.json(
      { error: "回答データがありません。" },
      { status: 400 },
    );
  }

  const kvKey = `career-ai:diagnosis:${body.diagnosisId}`;

  try {
    const raw = await kv.get<string>(kvKey);
    if (!raw) {
      return NextResponse.json(
        { error: "診断データが見つかりません。" },
        { status: 404 },
      );
    }

    const stored: StoredDiagnosis =
      typeof raw === "string" ? JSON.parse(raw) : raw;

    stored.selfAnalysis = body.answers;
    stored.selfAnalysisAt = Date.now();

    await kv.set(kvKey, JSON.stringify(stored), {
      ex: 60 * 60 * 24 * 90, // 90日
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("KV error:", err);
    return NextResponse.json(
      { error: "データの保存に失敗しました。" },
      { status: 500 },
    );
  }
}
