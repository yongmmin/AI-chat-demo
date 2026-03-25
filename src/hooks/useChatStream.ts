import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage, createChatStream } from "../remotes";
import type { Message, TextDeltaData, ArtifactDeltaData } from "../types/api";

const TYPING_SPEED = 12; // ms per character

export function useChatStream(sessionId: string | undefined, onDone?: () => void) {
  const [displayText, setDisplayText] = useState("");
  const [artifactText, setArtifactText] = useState("");
  const [artifactLanguage, setArtifactLanguage] = useState<string | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const bufferRef = useRef(""); // full received text
  const displayLenRef = useRef(0); // how many chars currently displayed
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const tick = useCallback(() => {
    if (displayLenRef.current < bufferRef.current.length) {
      // Reveal multiple chars per tick for faster catch-up when buffer is large
      const remaining = bufferRef.current.length - displayLenRef.current;
      const step = remaining > 20 ? 3 : 1;
      displayLenRef.current = Math.min(displayLenRef.current + step, bufferRef.current.length);
      setDisplayText(bufferRef.current.slice(0, displayLenRef.current));
      timerRef.current = window.setTimeout(tick, TYPING_SPEED);
    } else if (doneRef.current) {
      // All chars revealed and stream is done
      timerRef.current = null;
      setDisplayText("");
      setArtifactText("");
      setArtifactLanguage(undefined);
      setIsStreaming(false);
      onDone?.();
    } else {
      // Caught up, wait for more data
      timerRef.current = null;
    }
  }, [onDone]);

  const startTicking = useCallback(() => {
    if (timerRef.current === null) {
      timerRef.current = window.setTimeout(tick, TYPING_SPEED);
    }
  }, [tick]);

  const startStream = () => {
    if (!sessionId) return;

    bufferRef.current = "";
    displayLenRef.current = 0;
    doneRef.current = false;
    setDisplayText("");
    setArtifactText("");
    setArtifactLanguage(undefined);
    setIsStreaming(true);

    const es = createChatStream(sessionId);
    esRef.current = es;

    es.addEventListener("text_delta", (e: MessageEvent) => {
      try {
        const { content } = JSON.parse(e.data) as TextDeltaData;
        bufferRef.current += content;
        startTicking();
      } catch {
        // malformed JSON — skip
      }
    });

    es.addEventListener("artifact_delta", (e: MessageEvent) => {
      try {
        const { content, language } = JSON.parse(e.data) as ArtifactDeltaData;
        setArtifactText((prev) => prev + content);
        if (language) setArtifactLanguage(language);
      } catch {
        // malformed JSON — skip
      }
    });

    es.addEventListener("done", () => {
      es.close();
      doneRef.current = true;
      startTicking(); // ensure we flush remaining chars
    });
  };

  const send = async (content: string, onOptimistic?: (msg: Message) => void, style?: string) => {
    if (!sessionId) return;

    if (onOptimistic) {
      onOptimistic({
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      });
    }

    await sendMessage(sessionId, content, ...(style ? [style] : []) as []);
    startStream();
  };

  const close = () => {
    esRef.current?.close();
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return { streamText: displayText, artifactText, artifactLanguage, isStreaming, send, startStream, close };
}
