export const LINE_OA_ID = "@013dgraz";

export type LineShareContext =
  | "result"
  | "chat"
  | "chat-limit"
  | "interview"
  | "interview-review"
  | "interview-limit"
  | "resume";

export interface ShareUrls {
  resultShareUrl?: string;
  interviewShareUrl?: string;
}

export function buildLineMessage(
  context: LineShareContext,
  urls: ShareUrls
): string {
  let message = "";

  switch (context) {
    case "result":
      message = [
        "キャリアAIの診断結果をもとに相談させてください。",
        "",
        urls.resultShareUrl ? `📊 診断結果はこちら:\n${urls.resultShareUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      break;

    case "chat":
    case "chat-limit":
      message = "キャリアAIでのチャット相談の続きをお願いしたいです。";
      if (urls.resultShareUrl) {
        message += `\n\n📊 診断結果はこちら:\n${urls.resultShareUrl}`;
      }
      break;

    case "interview":
      message =
        "キャリアAIで生成された面接想定質問をもとに、面接対策をお願いしたいです。";
      if (urls.interviewShareUrl) {
        message += `\n\n🎤 想定質問はこちら:\n${urls.interviewShareUrl}`;
      }
      if (urls.resultShareUrl) {
        message += `\n\n📊 診断結果はこちら:\n${urls.resultShareUrl}`;
      }
      break;

    case "interview-review":
      message =
        "キャリアAIの面接対策結果を共有します。AIの添削結果もご確認いただけます。";
      if (urls.interviewShareUrl) {
        message += `\n\n🎤 想定質問＆添削結果:\n${urls.interviewShareUrl}`;
      }
      if (urls.resultShareUrl) {
        message += `\n\n📊 診断結果はこちら:\n${urls.resultShareUrl}`;
      }
      break;

    case "interview-limit":
      message =
        "キャリアAIで面接対策を始めました。プロの視点で添削＆アドバイスをお願いしたいです。";
      if (urls.interviewShareUrl) {
        message += `\n\n🎤 想定質問＆回答はこちら:\n${urls.interviewShareUrl}`;
      }
      if (urls.resultShareUrl) {
        message += `\n\n📊 診断結果はこちら:\n${urls.resultShareUrl}`;
      }
      break;

    case "resume":
      message =
        "キャリアAIで作成した書類を共有します。添削・アドバイスをお願いしたいです。";
      if (urls.resultShareUrl) {
        message += `\n\n📄 プロフィール・書類はこちら:\n${urls.resultShareUrl}`;
      }
      break;
  }

  return message;
}

export function buildLineOaUrl(message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OA_ID)}/?${encodedMessage}`;
}

/**
 * Opens LINE with a pre-filled message and copies to clipboard as fallback.
 * Returns toast message string.
 */
export async function openLineShare(
  context: LineShareContext,
  urls: ShareUrls
): Promise<string> {
  const message = buildLineMessage(context, urls);
  const lineUrl = buildLineOaUrl(message);

  // Open LINE
  window.open(lineUrl, "_blank");

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(message);
  } catch {
    // Clipboard unavailable — OK
  }

  // Mobile vs desktop toast message
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return isMobile
    ? "LINEが開きます。メッセージを確認して送信してください"
    : "メッセージがコピーされました。LINEで貼り付けて送信してください";
}
