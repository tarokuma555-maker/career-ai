import crypto from "crypto";

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive";

// ---------- 秘密鍵の解析 ----------

function parsePrivateKey(raw: string): crypto.KeyObject {
  let key = raw.trim();

  // 囲み引用符を除去
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // リテラル \n → 実際の改行に変換
  key = key.replace(/\\n/g, "\n").trim();

  // PEM ヘッダーがある場合
  if (key.includes("-----BEGIN PRIVATE KEY-----")) {
    try {
      return crypto.createPrivateKey(key);
    } catch {
      // PEM 解析失敗 → DER フォールバック
    }

    const b64 = key
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\s+/g, "");

    return crypto.createPrivateKey({
      key: Buffer.from(b64, "base64"),
      format: "der",
      type: "pkcs8",
    });
  }

  // PEM ヘッダーがない場合 → 生の Base64 データとして扱う
  const b64 = key.replace(/\s+/g, "");
  return crypto.createPrivateKey({
    key: Buffer.from(b64, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

// ---------- JWT 認証（サービスアカウント） ----------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
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

// ---------- ストレージ解放 ----------

/**
 * サービスアカウントが所有する古いファイルをすべて削除してストレージを解放する。
 * ゴミ箱も空にする。
 */
async function freeUpStorage(token: string): Promise<void> {
  // 1. ゴミ箱を空にする
  try {
    await fetch("https://www.googleapis.com/drive/v3/files/trash", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* ignore */ }

  // 2. 所有ファイルを一覧して削除
  try {
    const listRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=%27me%27+in+owners&fields=files(id)&pageSize=200",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!listRes.ok) return;

    const data = await listRes.json();
    const files: { id: string }[] = data.files || [];

    // 並列で削除（最大20件ずつ）
    for (let i = 0; i < files.length; i += 20) {
      const batch = files.slice(i, i + 20);
      await Promise.allSettled(
        batch.map((f) =>
          fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
      );
    }
  } catch { /* ignore */ }
}

// ---------- Google Drive アップロード ----------

async function doUpload(
  token: string,
  buffer: Buffer | Uint8Array,
  fileName: string,
  sourceMimeType: string,
  targetGoogleMimeType: string,
): Promise<{ id: string } | { error: string }> {
  const boundary = "---career_ai_upload_" + Date.now();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: targetGoogleMimeType,
    ...(folderId && { parents: [folderId] }),
  });

  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${sourceMimeType}\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(prefix.length + buffer.length + suffix.length);
  body.set(prefix, 0);
  body.set(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer, prefix.length);
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
    return { error: err.error?.message || "upload failed" };
  }

  return uploadRes.json();
}

/**
 * ファイルを Google Drive にアップロードし、Google 形式に変換する。
 * ストレージ不足の場合は古いファイルを削除してリトライする。
 */
export async function uploadToGoogleDrive(
  buffer: Buffer | Uint8Array,
  fileName: string,
  sourceMimeType: string,
  targetGoogleMimeType: string,
): Promise<string> {
  const token = await getAccessToken();

  // 1回目のアップロード試行
  let result = await doUpload(token, buffer, fileName, sourceMimeType, targetGoogleMimeType);

  // ストレージ不足の場合、古いファイルを削除してリトライ
  if ("error" in result && result.error.includes("quota")) {
    console.log("Storage quota exceeded, cleaning up old files...");
    await freeUpStorage(token);

    result = await doUpload(token, buffer, fileName, sourceMimeType, targetGoogleMimeType);
  }

  if ("error" in result) {
    throw new Error(result.error);
  }

  const fileId = result.id;

  // 共有設定: リンクを知っている全員が編集可
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "writer", type: "anyone" }),
    },
  );

  return fileId;
}
