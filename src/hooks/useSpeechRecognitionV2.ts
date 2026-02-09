"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useSpeechRecognitionV2() {
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isStoppedManually = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const restartTimer = useRef<any>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SR =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const rec = new SR();
    rec.lang = "ja-JP";
    rec.continuous = false; // iOS: must be false
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (finalText) {
        transcriptRef.current += finalText;
        setTranscript(transcriptRef.current);
        setInterimText("");
      } else {
        setInterimText(interim);
      }
    };

    rec.onend = () => {
      // continuous=false auto-ends after each phrase.
      // Restart unless manually stopped.
      if (!isStoppedManually.current) {
        restartTimer.current = setTimeout(() => {
          try {
            rec.start();
          } catch {
            setIsListening(false);
          }
        }, 200);
      } else {
        setIsListening(false);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setIsListening(false);
        return;
      }
      // no-speech, aborted, network → auto-restart
      if (!isStoppedManually.current) {
        restartTimer.current = setTimeout(() => {
          try {
            rec.start();
          } catch {
            setIsListening(false);
          }
        }, 300);
      }
    };

    recognitionRef.current = rec;

    return () => {
      if (restartTimer.current) clearTimeout(restartTimer.current);
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Must be called inside a user tap handler
  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    isStoppedManually.current = false;
    transcriptRef.current = "";
    setTranscript("");
    setInterimText("");
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {
          setIsListening(false);
        }
      }, 200);
    }
  }, []);

  const stopListening = useCallback(() => {
    isStoppedManually.current = true;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
    setInterimText("");
  }, []);

  const getTranscript = useCallback(() => {
    return transcriptRef.current;
  }, []);

  return {
    transcript,
    interimText,
    isListening,
    isSupported,
    startListening,
    stopListening,
    getTranscript,
  };
}
