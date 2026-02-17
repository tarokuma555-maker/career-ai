"use client";

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

/**
 * クライアント側で Google Drive にファイルをアップロードし、
 * Google Docs/Sheets の直接編集 URL を返す。
 *
 * @param token       Google OAuth アクセストークン
 * @param base64Data  ファイルの base64 エンコードデータ
 * @param fileName    ファイル名
 * @param sourceMime  元ファイルの MIME タイプ
 * @param targetMime  変換先の Google MIME タイプ
 * @returns Google Docs/Sheets の直接編集 URL
 */
export async function uploadToDriveClient(
  token: string,
  base64Data: string,
  fileName: string,
  sourceMime: string,
  targetMime: string,
): Promise<string> {
  // base64 → バイナリ変換
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // ファイル名から拡張子を除去
  const cleanName = fileName.replace(/\.(xlsx|docx|pptx|pdf)$/i, "");

  // マルチパートアップロード
  const boundary = "CareerAIBoundary" + Date.now();
  const metadata = JSON.stringify({ name: cleanName, mimeType: targetMime });

  const CRLF = "\r\n";
  const preamble = new TextEncoder().encode(
    `--${boundary}${CRLF}Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}${metadata}${CRLF}--${boundary}${CRLF}Content-Type: ${sourceMime}${CRLF}${CRLF}`,
  );
  const epilogue = new TextEncoder().encode(`${CRLF}--${boundary}--`);

  // パーツを結合
  const body = new Uint8Array(preamble.length + bytes.length + epilogue.length);
  body.set(preamble, 0);
  body.set(bytes, preamble.length);
  body.set(epilogue, preamble.length + bytes.length);

  const res = await fetch(
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Driveアップロード失敗: ${errText}`);
  }

  const fileData = await res.json();
  const fileId = fileData.id;
  if (!fileId) {
    throw new Error("ファイルIDが取得できませんでした。");
  }

  // 編集 URL を返す
  if (targetMime === "application/vnd.google-apps.spreadsheet") {
    return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  }
  if (targetMime === "application/vnd.google-apps.document") {
    return `https://docs.google.com/document/d/${fileId}/edit`;
  }
  return `https://drive.google.com/file/d/${fileId}/view`;
}
