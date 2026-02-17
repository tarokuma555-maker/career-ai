import crypto from "crypto";

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// ---------- 秘密鍵の解析 ----------

/**
 * 環境変数から取得した秘密鍵をパースする。
 * Vercel では \n がリテラル文字列として保存される場合があるため、
 * PEM 形式の解析に失敗した場合は DER 形式でのインポートにフォールバックする。
 */
function parsePrivateKey(raw: string): crypto.KeyObject {
  let pem = raw.trim();

  // 囲み引用符を除去（JSON からコピペした場合）
  if (
    (pem.startsWith('"') && pem.endsWith('"')) ||
    (pem.startsWith("'") && pem.endsWith("'"))
  ) {
    pem = pem.slice(1, -1);
  }

  // リテラル \n → 実際の改行に変換
  pem = pem.replace(/\\n/g, "\n");

  if (!pem.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error(
      `秘密鍵のフォーマットが不正です（先頭: "${pem.substring(0, 30)}..."）`,
    );
  }

  // 方法1: PEM 文字列としてパース
  try {
    return crypto.createPrivateKey(pem);
  } catch {
    // PEM 解析失敗 → DER フォールバック
  }

  // 方法2: Base64 データを抽出して DER としてインポート
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  return crypto.createPrivateKey({
    key: Buffer.from(b64, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

// ---------- JWT 認証（サービスアカウント） ----------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // キャッシュが有効ならそのまま返す
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("GOOGLE_DRIVE_NOT_CONFIGURED");
  }

  const privateKey = parsePrivateKey(rawKey);

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: SCOPES,
      aud: TOKEN_URI,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");

  const signature = crypto
    .sign("sha256", Buffer.from(`${header}.${payload}`), privateKey)
    .toString("base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token error: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
  };
  return data.access_token;
}

// ---------- Google Drive アップロード ----------

/**
 * ファイルを Google Drive にアップロードし、Google 形式に変換する。
 * 共有設定（リンクを知っている全員が編集可）を適用し、ファイルIDを返す。
 */
export async function uploadToGoogleDrive(
  buffer: Buffer | Uint8Array,
  fileName: string,
  sourceMimeType: string,
  targetGoogleMimeType: string,
): Promise<string> {
  const token = await getAccessToken();

  // マルチパートアップロード
  const boundary = "---career_ai_upload_" + Date.now();
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: targetGoogleMimeType,
  });

  const parts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    metadata,
    `\r\n--${boundary}\r\nContent-Type: ${sourceMimeType}\r\n\r\n`,
  ];

  // バイナリデータを含むマルチパートボディを構築
  const encoder = new TextEncoder();
  const prefix = encoder.encode(parts.join(""));
  const suffix = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(prefix.length + buffer.length + suffix.length);
  body.set(prefix, 0);
  body.set(
    buffer instanceof Buffer ? new Uint8Array(buffer) : buffer,
    prefix.length,
  );
  body.set(suffix, prefix.length + buffer.length);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
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
    const err = await uploadRes.json();
    throw new Error(
      err.error?.message || "Google Driveへのアップロードに失敗しました",
    );
  }

  const file = await uploadRes.json();

  // 共有設定: リンクを知っている全員が編集可
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "writer", type: "anyone" }),
    },
  );

  return file.id as string;
}
