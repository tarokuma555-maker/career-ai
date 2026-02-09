"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 480 },
          height: { ideal: 360 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const setVideo = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => setIsCameraOn(true))
              .catch(() => setIsCameraOn(true)); // video may still be flowing
          }
        } else {
          setTimeout(setVideo, 100);
        }
      };

      setVideo();
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError") {
        setCameraError("カメラの使用が許可されていません。");
      } else if (e.name === "NotFoundError") {
        setCameraError("カメラが見つかりません。");
      } else {
        setCameraError("カメラの起動に失敗しました。");
      }
      setIsCameraOn(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  }, []);

  const toggleCamera = useCallback(() => {
    if (isCameraOn) stopCamera();
    else startCamera();
  }, [isCameraOn, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { videoRef, isCameraOn, cameraError, startCamera, stopCamera, toggleCamera };
}
