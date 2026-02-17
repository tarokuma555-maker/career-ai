import crypto from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

// ---------- JWT 認証 ----------

function base64url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function parsePrivateKey(raw: string): crypto.KeyObject {
  let pem = raw.replace(/\\n/g, "\n");
  if (!pem.includes("-----BEGIN")) {
    pem = `-----BEGIN PRIVATE KEY-----\n${pem.trim()}\n-----END PRIVATE KEY-----\n`;
  }
  return crypto.createPrivateKey(pem);
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Google サービスアカウントの認証情報が設定されていません。",
    );
  }

  const key = parsePrivateKey(rawKey);
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signInput = `${header}.${payload}`;
  const signature = crypto.sign("SHA256", Buffer.from(signInput), key);
  const jwt = `${signInput}.${base64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${encodeURIComponent(jwt)}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google 認証に失敗しました: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ---------- Drive REST API ----------

async function cleanupOldFiles(token: string): Promise<void> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const q = encodeURIComponent(`createdTime < '${oneHourAgo}' and trashed = false`);
    const res = await fetch(
      `${DRIVE_API_URL}?q=${q}&fields=files(id)&pageSize=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return;

    const data = await res.json();
    const files: { id: string }[] = data.files || [];
    await Promise.allSettled(
      files.map((f) =>
        fetch(`${DRIVE_API_URL}/${f.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    );
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

/** ファイル名から拡張子を除去 */
function removeExtension(name: string): string {
  return name.replace(/\.(xlsx|docx|pptx|pdf)$/i, "");
}

/**
 * ファイルを Google Drive にアップロードし、Google 形式に変換して
 * Google Docs / Sheets の直接編集 URL を返す。
 */
export async function uploadToGoogleDrive(
  buffer: Buffer | Uint8Array,
  fileName: string,
  sourceMime: string,
  targetMime: string,
): Promise<string> {
  const token = await getAccessToken();

  // 事前クリーンアップ（ベストエフォート）
  await cleanupOldFiles(token);

  const cleanName = removeExtension(fileName);

  // マルチパートアップロード
  const boundary = "----CareerAIBoundary" + Date.now();
  const metadata = JSON.stringify({ name: cleanName, mimeType: targetMime });

  const CRLF = "\r\n";
  const parts = [
    `--${boundary}${CRLF}`,
    `Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}`,
    metadata,
    `${CRLF}--${boundary}${CRLF}`,
    `Content-Type: ${sourceMime}${CRLF}`,
    `Content-Transfer-Encoding: base64${CRLF}${CRLF}`,
    Buffer.from(buffer).toString("base64"),
    `${CRLF}--${boundary}--`,
  ];

  const body = parts.join("");

  const uploadRes = await fetch(
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

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive アップロードに失敗しました: ${errText}`);
  }

  const fileData = await uploadRes.json();
  const fileId = fileData.id;
  if (!fileId) {
    throw new Error("Google Drive へのファイル作成に失敗しました。");
  }

  // リンクを知っている全員が編集可能に
  const permRes = await fetch(
    `${DRIVE_API_URL}/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "writer", type: "anyone" }),
    },
  );

  if (!permRes.ok) {
    console.error("権限設定エラー:", await permRes.text());
  }

  return buildEditUrl(fileId, targetMime);
}
