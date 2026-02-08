import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import type { SharedQuestion } from "@/lib/types";

// ---------- 定数 ----------
const KV_PREFIX = "career-ai:interview:";
const TTL_SECONDS = 60 * 60 * 24 * 90; // 90日

// ---------- レート制限（インメモリ / HMR耐性） ----------
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const globalForRateLimit = globalThis as unknown as {
  _shareInterviewRateLimitLog?: Map<string, number[]>;
};
const requestLog =
  globalForRateLimit._shareInterviewRateLimitLog ??
  (globalForRateLimit._shareInterviewRateLimitLog = new Map<string, number[]>());

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  requestLog.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) {
    return true;
  }
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

// ---------- 共有データ型 ----------
interface ShareInterviewData {
  careerTitle: string;
  questions: SharedQuestion[];
  createdAt: number;
}

// ---------- POST: 新規作成 ----------
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "リクエスト回数の上限に達しました。1分後に再度お試しください。" },
      { status: 429 }
    );
  }

  let body: {
    careerTitle?: string;
    questions?: SharedQuestion[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 }
    );
  }

  if (!body.careerTitle || !body.questions || body.questions.length === 0) {
    return NextResponse.json(
      { error: "共有するデータが不足しています。" },
      { status: 400 }
    );
  }

  const payloadSize = JSON.stringify(body).length;
  if (payloadSize > 500_000) {
    return NextResponse.json(
      { error: "データサイズが大きすぎます。" },
      { status: 413 }
    );
  }

  const shareId = nanoid(12);
  const data: ShareInterviewData = {
    careerTitle: body.careerTitle,
    questions: body.questions,
    createdAt: Date.now(),
  };

  try {
    await kv.set(`${KV_PREFIX}${shareId}`, JSON.stringify(data), {
      ex: TTL_SECONDS,
    });
  } catch (err) {
    console.error("KV write error:", err);
    return NextResponse.json(
      { error: "共有リンクの作成に失敗しました。しばらく後にお試しください。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ shareId });
}

// ---------- PUT: 既存データ上書き更新 ----------
export async function PUT(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "リクエスト回数の上限に達しました。1分後に再度お試しください。" },
      { status: 429 }
    );
  }

  let body: {
    shareId?: string;
    careerTitle?: string;
    questions?: SharedQuestion[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が正しくありません。" },
      { status: 400 }
    );
  }

  if (!body.shareId || !body.careerTitle || !body.questions || body.questions.length === 0) {
    return NextResponse.json(
      { error: "共有するデータが不足しています。" },
      { status: 400 }
    );
  }

  const payloadSize = JSON.stringify(body).length;
  if (payloadSize > 500_000) {
    return NextResponse.json(
      { error: "データサイズが大きすぎます。" },
      { status: 413 }
    );
  }

  // 既存データの存在確認
  const existing = await kv.get<string>(`${KV_PREFIX}${body.shareId}`);
  if (!existing) {
    return NextResponse.json(
      { error: "指定された共有IDが見つかりません。" },
      { status: 404 }
    );
  }

  const data: ShareInterviewData = {
    careerTitle: body.careerTitle,
    questions: body.questions,
    createdAt: Date.now(),
  };

  try {
    await kv.set(`${KV_PREFIX}${body.shareId}`, JSON.stringify(data), {
      ex: TTL_SECONDS,
    });
  } catch (err) {
    console.error("KV write error:", err);
    return NextResponse.json(
      { error: "共有データの更新に失敗しました。しばらく後にお試しください。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ shareId: body.shareId });
}

// ---------- GET: 共有データ取得 ----------
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "共有IDが指定されていません。" },
      { status: 400 }
    );
  }

  try {
    const raw = await kv.get<string>(`${KV_PREFIX}${id}`);

    if (!raw) {
      return NextResponse.json(
        { error: "このリンクは期限切れか、存在しません。" },
        { status: 404 }
      );
    }

    const data: ShareInterviewData =
      typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({
      careerTitle: data.careerTitle,
      questions: data.questions,
    });
  } catch (err) {
    console.error("KV read error:", err);
    return NextResponse.json(
      { error: "共有データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}
