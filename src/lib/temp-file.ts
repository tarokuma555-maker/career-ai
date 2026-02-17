import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";

const KV_PREFIX = "career-ai:temp-file:";
const TTL_SECONDS = 60 * 60; // 1時間

function getOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * ファイルを一時保存し、Google Docs/Sheets で開くための URL を返す。
 */
export async function storeTempFile(
  buffer: Uint8Array | Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ fileUrl: string; googleUrl: string }> {
  const id = nanoid(16);
  const data = Buffer.from(buffer).toString("base64");

  await kv.set(
    `${KV_PREFIX}${id}`,
    JSON.stringify({ data, mimeType, fileName }),
    { ex: TTL_SECONDS },
  );

  const origin = getOrigin();
  const fileUrl = `${origin}/api/export/temp/${id}`;

  // Google Viewer で開く URL（.docx / .xlsx を表示し、Google Docs/Sheets で開くオプションあり）
  const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}`;

  return { fileUrl, googleUrl };
}
