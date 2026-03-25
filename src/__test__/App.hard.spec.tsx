import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUI } from "./utils/renderUI";

// ─── Mock remotes ────────────────────────────────────────────────────
vi.mock("../remotes", () => ({
  getSessions: vi.fn(),
  getSession: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  sendMessage: vi.fn(),
  createChatStream: vi.fn(),
}));

import {
  getSessions,
  getSession,
  createSession,
  deleteSession,
  sendMessage,
  createChatStream,
} from "../remotes";

const mockGetSessions = vi.mocked(getSessions);
const mockGetSession = vi.mocked(getSession);
const mockCreateSession = vi.mocked(createSession);
const mockDeleteSession = vi.mocked(deleteSession);
const mockSendMessage = vi.mocked(sendMessage);
const mockCreateChatStream = vi.mocked(createChatStream);

// ─── Helpers ─────────────────────────────────────────────────────────

function createMockEventSource(events: Array<{ event: string; data: string }>) {
  const listeners: Record<string, Function[]> = {};
  let scheduled = false;

  const scheduleEvents = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      for (const evt of events) {
        const messageEvent = new MessageEvent(evt.event, { data: evt.data });
        listeners[evt.event]?.forEach((fn) => fn(messageEvent));
      }
    }, 0);
  };

  return {
    addEventListener: vi.fn((eventName: string, handler: Function) => {
      listeners[eventName] = listeners[eventName] || [];
      listeners[eventName].push(handler);
      scheduleEvents();
    }),
    removeEventListener: vi.fn(),
    close: vi.fn(),
  };
}

const SAMPLE_SESSION_DETAIL = {
  id: "session-1",
  title: "프로젝트 회의록 정리",
  createdAt: "2025-01-15T09:30:00Z",
  messages: [
    {
      id: "msg-1",
      role: "user" as const,
      content: "회의록을 정리해줘",
      createdAt: "2025-01-15T09:30:00Z",
    },
  ],
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("Hard — 서버 버그 대응", () => {
  beforeEach(() => {
    mockGetSessions.mockResolvedValue({
      sessions: [
        {
          id: "session-1",
          title: "프로젝트 회의록 정리",
          createdAt: "2025-01-15T09:30:00Z",
          lastMessage: "오늘 스프린트 회의 내용을 정리해줘",
        },
        {
          id: "session-2",
          title: null,
          createdAt: "2025-01-14T14:20:00Z",
          lastMessage: "React useEffect 클린업 패턴을 설명해줘",
        },
        {
          id: "session-3",
          title: "이메일 초안 작성",
          createdAt: "2025-01-14T10:00:00Z",
          lastMessage: "프로젝트 일정 지연 안내 이메일을 작성해줘",
        },
      ],
      total: 3,
    });
    mockGetSession.mockResolvedValue(SAMPLE_SESSION_DETAIL);
    mockSendMessage.mockResolvedValue({ id: "new-msg-1" });
    mockDeleteSession.mockResolvedValue(undefined);
  });

  // ─── Hard 1: SSE malformed JSON 내성 ─────────────────────────────
  it("SSE에서 malformed JSON이 와도 정상 이벤트를 처리한다", async () => {
    const user = userEvent.setup();
    mockCreateChatStream.mockImplementation(() =>
      createMockEventSource([
        { event: "text_delta", data: JSON.stringify({ content: "첫 번째 " }) },
        { event: "text_delta", data: "{malformed json}" }, // ← 깨진 JSON
        { event: "text_delta", data: JSON.stringify({ content: "두 번째 " }) },
        { event: "text_delta", data: "not json at all" }, // ← 또 깨진 JSON
        { event: "text_delta", data: JSON.stringify({ content: "세 번째" }) },
        { event: "done", data: "{}" },
      ]) as unknown as EventSource,
    );

    renderUI(["/chat/session-1"]);

    await waitFor(() => {
      expect(screen.getByText("회의록을 정리해줘")).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "테스트");
    await user.click(screen.getByRole("button", { name: /전송|보내기|send/i }));

    // 깨진 JSON을 무시하고 정상 이벤트만 누적되어야 함
    await waitFor(() => {
      expect(screen.getByText(/첫 번째 두 번째 세 번째/)).toBeInTheDocument();
    });
  });

  // ─── Hard 2: 에러 포맷 정규화 ────────────────────────────────────
  it("createSession의 400 {error}와 500 {message}를 모두 에러 메시지로 표시한다", async () => {
    const user = userEvent.setup();

    // 400 에러: {error} 포맷
    mockCreateSession.mockRejectedValueOnce({ error: "Message is required" });

    renderUI(["/"]);

    await waitFor(() => {
      expect(mockGetSessions).toHaveBeenCalled();
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "테스트");
    await user.click(screen.getByRole("button", { name: /전송|보내기|send|시작/i }));

    // {error} 포맷의 에러 메시지가 표시되어야 함
    await waitFor(() => {
      expect(screen.getByText(/Message is required/i)).toBeInTheDocument();
    });

    // 500 에러: {message} 포맷
    mockCreateSession.mockRejectedValueOnce({ message: "Internal server error" });

    await user.clear(input);
    await user.type(input, "다시 테스트");
    await user.click(screen.getByRole("button", { name: /전송|보내기|send|시작/i }));

    // {message} 포맷의 에러 메시지도 표시되어야 함
    await waitFor(() => {
      expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
    });
  });

  // ─── Hard 3: 세션 제목 null → 첫 메시지 대체 ────────────────────
  it("title이 null인 세션은 첫 user 메시지를 제목으로 표시한다", async () => {
    mockGetSessions.mockResolvedValue({
      sessions: [
        {
          id: "session-titled",
          title: "정상 제목",
          createdAt: "2025-01-15T00:00:00Z",
          lastMessage: "msg",
        },
        {
          id: "session-null-title",
          title: null,
          createdAt: "2025-01-14T00:00:00Z",
          lastMessage: "React useEffect 클린업 패턴을 설명해줘",
        },
      ],
      total: 2,
    });

    renderUI(["/"]);

    await waitFor(() => {
      expect(screen.getByText("정상 제목")).toBeInTheDocument();
    });

    // title이 null인 세션은 lastMessage (또는 첫 유저 메시지)를 제목으로 표시
    expect(
      screen.getByText(/React useEffect 클린업 패턴을 설명해줘/),
    ).toBeInTheDocument();

    // "null"이 텍스트로 표시되면 안 됨
    const allText = document.body.textContent || "";
    expect(allText).not.toContain("null");
  });
});
