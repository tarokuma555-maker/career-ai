import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";

const KV_PREFIX = "career-ai:profile:";
const TTL_SECONDS = 60 * 60 * 24 * 90; // 90日

// ---------- レート制限 ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const globalForRateLimit = globalThis as unknown as { _profileShareRL?: Map<string, number[]> };
const requestLog = globalForRateLimit._profileShareRL ?? (globalForRateLimit._profileShareRL = new Map<string, number[]>());

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  requestLog.set(ip, recent);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

// ---------- POST: 作成/更新 ----------
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "リクエスト回数の上限に達しました。" }, { status: 429 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const payloadSize = JSON.stringify(body).length;
  if (payloadSize > 1_000_000) {
    return NextResponse.json({ error: "データサイズが大きすぎます。" }, { status: 413 });
  }

  const shareId = body.shareId || nanoid(12);
  const now = new Date().toISOString();

  const data = {
    basicInfo: body.basicInfo || null,
    resumeData: body.resumeData || null,
    generatedResume: body.generatedResume || null,
    generatedCV: body.generatedCV || null,
    diagnosisShareId: body.diagnosisShareId || null,
    interviewShareId: body.interviewShareId || null,
    createdAt: body.shareId ? undefined : now, // 新規のみ
    updatedAt: now,
  };

  // 既存データがあればcreatedAtを維持
  if (body.shareId) {
    try {
      const existing = await kv.get<string>(`${KV_PREFIX}${shareId}`);
      if (existing) {
        const parsed = typeof existing === "string" ? JSON.parse(existing) : existing;
        data.createdAt = parsed.createdAt || now;
      } else {
        data.createdAt = now;
      }
    } catch {
      data.createdAt = now;
    }
  }

  try {
    await kv.set(`${KV_PREFIX}${shareId}`, JSON.stringify(data), { ex: TTL_SECONDS });
  } catch (err) {
    console.error("KV write error:", err);
    return NextResponse.json({ error: "プロフィール共有の作成に失敗しました。" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  return NextResponse.json({
    shareId,
    shareUrl: `${appUrl}/profile/share/${shareId}`,
  });
}

// ---------- GET: 取得 ----------
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "IDが指定されていません。" }, { status: 400 });
  }

  try {
    const raw = await kv.get<string>(`${KV_PREFIX}${id}`);
    if (!raw) {
      return NextResponse.json({ error: "このリンクは期限切れか、存在しません。" }, { status: 404 });
    }
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json(data);
  } catch (err) {
    console.error("KV read error:", err);
    return NextResponse.json({ error: "データの取得に失敗しました。" }, { status: 500 });
  }
}
