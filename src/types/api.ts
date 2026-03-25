/** GET /api/sessions 응답의 세션 항목 */
export interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  lastMessage: string;
}

/** GET /api/sessions/:id 응답 (camelCase) */
export interface ChatSessionDetail {
  id: string;
  title: string | null;
  createdAt: string;
  messages: Message[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifact?: {
    content: string;
    language?: string;
  };
  createdAt: string;
}

/**
 * SSE named event 데이터 타입
 *
 * EventSource의 named event로 수신됩니다:
 *   es.addEventListener("text_delta", handler)     → { content }
 *   es.addEventListener("artifact_delta", handler)  → { content, language? }
 *   es.addEventListener("done", handler)            → { title? }
 */
export type TextDeltaData = { content: string };
export type ArtifactDeltaData = { content: string; language?: string };
export type DoneData = { title?: string };
