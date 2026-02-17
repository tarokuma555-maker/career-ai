import { google } from "googleapis";
import { Readable } from "stream";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Google サービスアカウントの認証情報が設定されていません（GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY）。",
    );
  }

  // Vercel の環境変数ではリテラル \n が入ることがある
  let privateKey = rawKey.replace(/\\n/g, "\n");
  // PEM ヘッダーがなければ付与
  if (!privateKey.includes("-----BEGIN")) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey.trim()}\n-----END PRIVATE KEY-----\n`;
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

/**
 * 古いファイル（1時間以上前）をサービスアカウントの Drive から削除する。
 * ストレージ枯渇を防ぐためのベストエフォート処理。
 */
async function cleanupOldFiles(
  drive: ReturnType<typeof google.drive>,
): Promise<void> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await drive.files.list({
      q: `createdTime < '${oneHourAgo}' and trashed = false`,
      fields: "files(id)",
      pageSize: 50,
    });
    const files = res.data.files || [];
    await Promise.allSettled(
      files.map((f) => (f.id ? drive.files.delete({ fileId: f.id }) : Promise.resolve())),
    );
    if (files.length > 0) {
      await drive.files.emptyTrash().catch(() => {});
    }
  } catch {
    // クリーンアップは失敗しても続行
  }
}

/** Google MIME タイプに対応する直接編集 URL を生成 */
function buildEditUrl(fileId: string, targetMime: string): string {
  if (targetMime === "application/vnd.google-apps.spreadsheet") {
    return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  }
  if (targetMime === "application/vnd.google-apps.document") {
    return `https://docs.google.com/document/d/${fileId}/edit`;
  }
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** ファイル名から拡張子を除去（Google ネイティブ形式では不要） */
function removeExtension(name: string): string {
  return name.replace(/\.(xlsx|docx|pptx|pdf)$/i, "");
}

/**
 * ファイルを Google Drive にアップロードし、Google 形式に変換して
 * Google Docs / Sheets の直接編集 URL を返す。
 *
 * @param buffer       アップロードするファイルデータ
 * @param fileName     ファイル名（拡張子は自動除去）
 * @param sourceMime   元ファイルの MIME タイプ
 * @param targetMime   変換先の Google 形式 MIME タイプ
 * @returns Google Docs/Sheets の直接編集 URL
 */
export async function uploadToGoogleDrive(
  buffer: Buffer | Uint8Array,
  fileName: string,
  sourceMime: string,
  targetMime: string,
): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  // 事前クリーンアップ
  await cleanupOldFiles(drive);

  // ファイル名から拡張子を除去（Google 形式では不要）
  const cleanName = removeExtension(fileName);

  // アップロード＋Google 形式に変換
  const file = await drive.files.create({
    requestBody: {
      name: cleanName,
      mimeType: targetMime,
    },
    media: {
      mimeType: sourceMime,
      body: Readable.from(Buffer.from(buffer)),
    },
    fields: "id",
  });

  const fileId = file.data.id;
  if (!fileId) {
    throw new Error("Google Drive へのファイル作成に失敗しました。");
  }

  // リンクを知っている全員が編集可能に（Google ログインは必要）
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "writer",
      type: "anyone",
    },
  });

  return buildEditUrl(fileId, targetMime);
}
