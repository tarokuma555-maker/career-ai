import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_PREFIX = "career-ai:temp-file:";

interface TempFile {
  data: string; // base64
  mimeType: string;
  fileName: string;
}

/**
 * 一時保存されたファイルを配信する（認証不要 → Google Viewer がアクセスできるように）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const raw = await kv.get<string>(`${KV_PREFIX}${id}`);
  if (!raw) {
    return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
  }

  const file: TempFile = typeof raw === "string" ? JSON.parse(raw) : raw;
  const buffer = Buffer.from(file.data, "base64");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
