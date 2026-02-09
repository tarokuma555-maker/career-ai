"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// Split text at punctuation for reliable iOS TTS
function splitText(text: string, maxLen: number): string[] {
  const delimiters = ["。", "！", "？", "、", "．", "\n"];
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let cut = -1;
    for (let i = Math.min(maxLen, remaining.length) - 1; i >= 0; i--) {
      if (delimiters.includes(remaining[i])) {
        cut = i + 1;
        break;
      }
    }
    if (cut <= 0) cut = maxLen;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trim();
  }
  return chunks.filter((c) => c.length > 0);
}

export function useSpeechSynthesisV2() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const voicesReadyRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        voicesRef.current = v;
        voicesReadyRef.current = true;
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // iOS: poll for voices if onvoiceschanged doesn't fire
    let attempts = 0;
    const poll = setInterval(() => {
      loadVoices();
      attempts++;
      if (voicesReadyRef.current || attempts > 20) {
        clearInterval(poll);
      }
    }, 250);

    return () => {
      clearInterval(poll);
      window.speechSynthesis.cancel();
    };
  }, []);

  // Must be called inside a user tap handler on iOS
  const activate = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const dummy = new SpeechSynthesisUtterance("");
    dummy.volume = 0;
    window.speechSynthesis.speak(dummy);
    setIsActivated(true);
  }, []);

  const getJapaneseVoice = useCallback(() => {
    const voices = voicesRef.current;
    return (
      voices.find((v) => v.lang === "ja-JP" && v.name.includes("Kyoko")) ||
      voices.find((v) => v.lang === "ja-JP" && v.name.includes("Otoya")) ||
      voices.find((v) => v.lang === "ja-JP" && v.localService) ||
      voices.find((v) => v.lang === "ja-JP") ||
      voices.find((v) => v.lang.startsWith("ja")) ||
      null
    );
  }, []);

  const speak = useCallback(
    (text: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (
          typeof window === "undefined" ||
          !("speechSynthesis" in window) ||
          !text.trim()
        ) {
          resolve(false);
          return;
        }

        window.speechSynthesis.cancel();
        cancelledRef.current = false;

        const chunks = splitText(text, 100);
        let index = 0;
        let hasSpoken = false;

        const speakNext = () => {
          if (cancelledRef.current || index >= chunks.length) {
            setIsSpeaking(false);
            resolve(hasSpoken);
            return;
          }

          const utterance = new SpeechSynthesisUtterance(chunks[index]);
          utterance.lang = "ja-JP";
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          const voice = getJapaneseVoice();
          if (voice) utterance.voice = voice;

          utterance.onstart = () => {
            hasSpoken = true;
            setIsSpeaking(true);
          };

          utterance.onend = () => {
            index++;
            setTimeout(speakNext, 80);
          };

          utterance.onerror = () => {
            index++;
            setTimeout(speakNext, 80);
          };

          window.speechSynthesis.speak(utterance);

          // iOS Safari freeze workaround: pause+resume forces onend to fire
          setTimeout(() => {
            try {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            } catch {
              /* ignore */
            }
          }, 50);
        };

        speakNext();

        // Global timeout
        const timeout = Math.max(30000, text.length * 200);
        setTimeout(() => {
          if (!cancelledRef.current && index < chunks.length) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            resolve(hasSpoken);
          }
        }, timeout);
      });
    },
    [getJapaneseVoice],
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return { speak, stop, activate, isSpeaking, isSupported, isActivated };
}
