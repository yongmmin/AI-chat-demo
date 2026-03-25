import type { SSEStreamingApi } from "hono/streaming";
import type { Message, Session, StreamEvent } from "./types.js";

export function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getSessionSummary(session: Session) {
  const lastMsg = session.messages[session.messages.length - 1];
  return {
    id: session.id,
    title: session.title,
    createdAt: session.created_at,
    lastMessage: lastMsg?.content?.slice(0, 80) ?? "",
  };
}

export async function writeSSE(stream: SSEStreamingApi, event: StreamEvent): Promise<void> {
  const { type, ...data } = event;
  if (Math.random() < 0.1 && type !== "done") {
    await stream.writeSSE({ event: type, data: "{malformed json}" });
  } else {
    await stream.writeSSE({ event: type, data: JSON.stringify(data) });
  }
}

export function saveAssistantMessage(
  session: Session,
  { text, artifact, language }: { text: string; artifact?: string; language?: string },
): void {
  const msg: Message = {
    id: generateId(),
    role: "assistant",
    content: text,
    createdAt: new Date().toISOString(),
  };
  if (artifact) {
    msg.artifact = { content: artifact };
    if (language) msg.artifact.language = language;
  }
  session.messages.push(msg);

  if (!session.title && text) {
    session.title = text.split("\n")[0].slice(0, 50);
  }
}
