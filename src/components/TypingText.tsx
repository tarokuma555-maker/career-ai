"use client";

import { useState, useEffect } from "react";

interface TypingTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

export default function TypingText({
  text,
  speed = 50,
  delay = 0,
  className,
  as: Tag = "span",
}: TypingTextProps) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!started || displayed.length >= text.length) return;
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [started, displayed, text, speed]);

  const done = displayed.length >= text.length;

  return (
    <Tag className={className}>
      {displayed}
      {!done && (
        <span
          className="inline-block w-0.5 h-[1em] ml-0.5 align-middle animate-typewriter-blink"
          style={{ backgroundColor: "var(--accent-blue)" }}
        />
      )}
    </Tag>
  );
}
