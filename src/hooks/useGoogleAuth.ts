"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
            }) => void;
            error_callback?: (error: { message?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

interface PendingRequest {
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}

/**
 * Google OAuth アクセストークンを取得するフック。
 * ユーザーの Google アカウントで Google Drive にファイルをアップロードするために使用。
 */
export function useGoogleAuth() {
  const [ready, setReady] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef(0);
  const clientRef = useRef<{ requestAccessToken: () => void } | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    // GSI がすでに読み込まれている場合
    if (window.google?.accounts?.oauth2) {
      initClient(clientId);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => initClient(clientId);
    document.head.appendChild(script);

    function initClient(id: string) {
      if (!window.google) return;
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response) => {
          if (response.error) {
            pendingRef.current?.reject(
              new Error(`Google認証エラー: ${response.error}`),
            );
            pendingRef.current = null;
            return;
          }
          if (response.access_token) {
            tokenRef.current = response.access_token;
            expiresAtRef.current =
              Date.now() + (response.expires_in ?? 3600) * 1000 - 60_000;
            pendingRef.current?.resolve(response.access_token);
            pendingRef.current = null;
          }
        },
        error_callback: (error) => {
          pendingRef.current?.reject(
            new Error(error.message || "Google認証がキャンセルされました"),
          );
          pendingRef.current = null;
        },
      });
      setReady(true);
    }
  }, []);

  const getAccessToken = useCallback((): Promise<string> => {
    // キャッシュされたトークンが有効ならそのまま返す
    if (tokenRef.current && Date.now() < expiresAtRef.current) {
      return Promise.resolve(tokenRef.current);
    }

    return new Promise((resolve, reject) => {
      if (!clientRef.current) {
        reject(
          new Error(
            "Google認証の準備ができていません。NEXT_PUBLIC_GOOGLE_CLIENT_ID を確認してください。",
          ),
        );
        return;
      }
      pendingRef.current = { resolve, reject };
      clientRef.current.requestAccessToken();
    });
  }, []);

  return { getAccessToken, ready };
}
