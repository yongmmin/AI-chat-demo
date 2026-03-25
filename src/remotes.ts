import type { ChatSession, ChatSessionDetail } from "./types/api";

const BASE = "/api";

/**
 * 세션 목록 조회 (페이지네이션)
 * 주의: 서버가 limit+1개를 반환할 수 있음
 */
export async function getSessions(
  params: { page?: number; limit?: number } = {},
): Promise<{ sessions: ChatSession[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));

  const res = await fetch(`${BASE}/sessions?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

/** 세션 상세 조회 */
export async function getSession(id: string): Promise<ChatSessionDetail> {
  const res = await fetch(`${BASE}/sessions/${id}`);
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

/**
 * 새 세션 생성
 * 주의: 에러 시 서버 응답을 그대로 throw (400: {error}, 500: {message})
 */
export async function createSession(body: {
  message: string;
}): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

/** 세션 삭제 — 서버에 지연이 있을 수 있음 */
export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

/**
 * 메시지 전송
 * 주의: 에러 시 서버 응답을 그대로 throw
 */
export async function sendMessage(
  sessionId: string,
  content: string,
  style?: string,
): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ...(style && { style }) }),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

/**
 * SSE 스트림 생성 — EventSource 인스턴스 직접 반환
 *
 * Named event로 수신됩니다:
 *   es.addEventListener("text_delta", handler)     → JSON.parse(e.data).content
 *   es.addEventListener("artifact_delta", handler)  → JSON.parse(e.data).content
 *   es.addEventListener("done", handler)            → 스트리밍 완료, es.close()
 *
 * 주의: data 필드의 JSON이 깨져 있을 수 있습니다 (서버 버그)
 */
export function createChatStream(sessionId: string): EventSource {
  return new EventSource(`${BASE}/sessions/${sessionId}/stream`);
}
