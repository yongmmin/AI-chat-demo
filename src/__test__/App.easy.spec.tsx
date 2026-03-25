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

/**
 * EventSource mock — named event를 순차 발행합니다.
 * 반드시 mockImplementation(() => createMockEventSource(...))으로 사용하세요.
 */
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

const SAMPLE_SESSIONS = {
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
};

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
    {
      id: "msg-2",
      role: "assistant" as const,
      content: "회의록을 정리했습니다.",
      artifact: { content: "# 회의록\n\n- 항목 1\n- 항목 2", language: "markdown" },
      createdAt: "2025-01-15T09:31:00Z",
    },
  ],
};

const QUICK_TABS = [
  "회의록 정리해줘",
  "이메일 초안 작성해줘",
  "코드 리뷰 해줘",
  "데이터 요약해줘",
  "번역해줘",
  "아이디어 브레인스토밍",
];

// ─── Tests ───────────────────────────────────────────────────────────

describe("Easy — 기본 구현", () => {
  beforeEach(() => {
    mockGetSessions.mockResolvedValue(SAMPLE_SESSIONS);
    mockGetSession.mockResolvedValue(SAMPLE_SESSION_DETAIL);
    mockCreateSession.mockResolvedValue({ id: "new-session-1" });
    mockDeleteSession.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue({ id: "new-msg-1" });
  });

  // ─── 1. 세션 목록 렌더링 ─────────────────────────────────────────
  it("홈에서 최근 세션 목록을 렌더링한다", async () => {
    renderUI(["/"]);

    await waitFor(() => {
      expect(screen.getByText("프로젝트 회의록 정리")).toBeInTheDocument();
    });

    expect(screen.getByText("이메일 초안 작성")).toBeInTheDocument();
    expect(mockGetSessions).toHaveBeenCalled();
  });

  // ─── 2. 퀵탭 → 새 세션 ──────────────────────────────────────────
  it("퀵탭 클릭 시 새 세션을 생성하고 채팅 페이지로 이동한다", async () => {
    const user = userEvent.setup();
    mockCreateSession.mockResolvedValue({ id: "quick-session-1" });
    mockGetSession.mockResolvedValue({
      id: "quick-session-1",
      title: null,
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: "msg-q1",
          role: "user",
          content: "회의록 정리해줘",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    renderUI(["/"]);

    await waitFor(() => {
      expect(screen.getByText("회의록 정리해줘")).toBeInTheDocument();
    });

    await user.click(screen.getByText("회의록 정리해줘"));

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        message: "회의록 정리해줘",
      });
    });
  });

  // ─── 3. 이전 메시지 로드 ─────────────────────────────────────────
  it("채팅 페이지 진입 시 이전 대화를 표시한다", async () => {
    renderUI(["/chat/session-1"]);

    await waitFor(() => {
      expect(screen.getByText("회의록을 정리해줘")).toBeInTheDocument();
    });

    expect(screen.getByText("회의록을 정리했습니다.")).toBeInTheDocument();
    expect(mockGetSession).toHaveBeenCalledWith("session-1");
  });

  // ─── 4. 메시지 전송 + SSE text_delta ─────────────────────────────
  it("메시지 전송 후 SSE text_delta를 채팅에 누적 렌더링한다", async () => {
    const user = userEvent.setup();
    mockCreateChatStream.mockImplementation(() =>
      createMockEventSource([
        { event: "text_delta", data: JSON.stringify({ content: "안녕하세요" }) },
        { event: "text_delta", data: JSON.stringify({ content: ", 도움이 필요하시면" }) },
        { event: "text_delta", data: JSON.stringify({ content: " 말씀해주세요." }) },
        { event: "done", data: "{}" },
      ]) as unknown as EventSource,
    );

    renderUI(["/chat/session-1"]);

    await waitFor(() => {
      expect(screen.getByText("회의록을 정리해줘")).toBeInTheDocument();
    });

    // 메시지 입력 및 전송
    const input = screen.getByRole("textbox");
    await user.type(input, "안녕!");
    await user.click(screen.getByRole("button", { name: /전송|보내기|send/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("session-1", "안녕!");
    });

    // SSE 텍스트가 누적 렌더링되었는지 확인
    await waitFor(() => {
      expect(
        screen.getByText(/안녕하세요, 도움이 필요하시면 말씀해주세요\./),
      ).toBeInTheDocument();
    });
  });

  // ─── 5. 스트리밍 로딩 상태 ───────────────────────────────────────
  // 이 테스트는 이벤트를 수동 제어하여 중간 상태(로딩)를 검증합니다.
  it("스트리밍 중 '답변 생성 중' 표시 후 done에서 사라진다", async () => {
    const user = userEvent.setup();

    // named event를 수동으로 발행할 수 있는 콜백
    let fire: (eventName: string, data: string) => void = () => {};
    mockCreateChatStream.mockImplementation(() => {
      const listeners: Record<string, Function[]> = {};
      return {
        addEventListener: vi.fn((eventName: string, handler: Function) => {
          listeners[eventName] = listeners[eventName] || [];
          listeners[eventName].push(handler);
          fire = (name, data) =>
            listeners[name]?.forEach((fn) =>
              fn(new MessageEvent(name, { data })),
            );
        }),
        removeEventListener: vi.fn(),
        close: vi.fn(),
      } as unknown as EventSource;
    });

    renderUI(["/chat/session-1"]);

    await waitFor(() => {
      expect(screen.getByText("회의록을 정리해줘")).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "테스트");
    await user.click(screen.getByRole("button", { name: /전송|보내기|send/i }));

    // text_delta 발행 → 로딩 표시
    fire("text_delta", JSON.stringify({ content: "응답 중..." }));

    await waitFor(() => {
      expect(screen.getByText(/답변 생성 중|생성 중|loading/i)).toBeInTheDocument();
    });

    // done 발행 → 로딩 사라짐
    fire("done", "{}");

    await waitFor(() => {
      expect(screen.queryByText(/답변 생성 중|생성 중|loading/i)).not.toBeInTheDocument();
    });
  });

  // ─── 6. 아티팩트 프리뷰 ──────────────────────────────────────────
  it("artifact_delta를 프리뷰 영역에 렌더링한다", async () => {
    const user = userEvent.setup();
    mockCreateChatStream.mockImplementation(() =>
      createMockEventSource([
        { event: "text_delta", data: JSON.stringify({ content: "코드를 작성했습니다." }) },
        { event: "artifact_delta", data: JSON.stringify({ content: "const x = 1;\n" }) },
        { event: "artifact_delta", data: JSON.stringify({ content: "const y = 2;\n" }) },
        { event: "done", data: "{}" },
      ]) as unknown as EventSource,
    );

    renderUI(["/chat/session-1"]);

    await waitFor(() => {
      expect(screen.getByText("회의록을 정리해줘")).toBeInTheDocument();
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "코드 작성해줘");
    await user.click(screen.getByRole("button", { name: /전송|보내기|send/i }));

    // 프리뷰 영역에 아티팩트 내용이 표시되는지 확인
    await waitFor(() => {
      expect(screen.getByText(/const x = 1/)).toBeInTheDocument();
      expect(screen.getByText(/const y = 2/)).toBeInTheDocument();
    });
  });

  // ─── 7. 채팅 기록 목록 ──────────────────────────────────────────
  it("히스토리 페이지에서 세션 목록을 표시하고 클릭 시 이동한다", async () => {
    const user = userEvent.setup();
    renderUI(["/history"]);

    await waitFor(() => {
      expect(screen.getByText("프로젝트 회의록 정리")).toBeInTheDocument();
    });

    expect(screen.getByText("이메일 초안 작성")).toBeInTheDocument();

    // 세션 클릭 시 /chat/:id로 이동해야 함
    const sessionLink = screen.getByText("프로젝트 회의록 정리");
    await user.click(sessionLink);

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledWith("session-1");
    });
  });

  // ─── 8. 세션 삭제 ───────────────────────────────────────────────
  it("히스토리에서 세션을 삭제하면 목록에서 제거된다", async () => {
    const user = userEvent.setup();
    renderUI(["/history"]);

    await waitFor(() => {
      expect(screen.getByText("프로젝트 회의록 정리")).toBeInTheDocument();
    });

    // "프로젝트 회의록 정리" 세션의 삭제 버튼 클릭
    const sessionItems = screen.getAllByRole("button", { name: /삭제|delete/i });
    await user.click(sessionItems[0]);

    await waitFor(() => {
      expect(mockDeleteSession).toHaveBeenCalledWith("session-1");
    });

    // 삭제 후 목록에서 사라져야 함
    await waitFor(() => {
      expect(screen.queryByText("프로젝트 회의록 정리")).not.toBeInTheDocument();
    });
  });

  // ─── 9. 마크다운 코드블록 렌더링 ─────────────────────────────────
  it("프리뷰의 코드블록을 <pre> 또는 <code>로 렌더링한다", async () => {
    mockGetSession.mockResolvedValue({
      id: "session-code",
      title: "코드 세션",
      createdAt: "2025-01-15T09:30:00Z",
      messages: [
        {
          id: "msg-c1",
          role: "user" as const,
          content: "코드 보여줘",
          createdAt: "2025-01-15T09:30:00Z",
        },
        {
          id: "msg-c2",
          role: "assistant" as const,
          content: "코드를 준비했습니다.",
          artifact: {
            content: "```typescript\nconst greeting = 'hello';\nconsole.log(greeting);\n```",
            language: "typescript",
          },
          createdAt: "2025-01-15T09:31:00Z",
        },
      ],
    });

    renderUI(["/chat/session-code"]);

    await waitFor(() => {
      const codeBlock =
        screen.getByText(/const greeting/).closest("pre") ||
        screen.getByText(/const greeting/).closest("code");
      expect(codeBlock).toBeInTheDocument();
    });
  });

  // ─── 10. 직접 입력 새 세션 ───────────────────────────────────────
  it("홈에서 직접 메시지를 입력하면 새 세션을 생성하고 이동한다", async () => {
    const user = userEvent.setup();
    mockCreateSession.mockResolvedValue({ id: "direct-session-1" });
    mockGetSession.mockResolvedValue({
      id: "direct-session-1",
      title: null,
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: "msg-d1",
          role: "user",
          content: "안녕하세요",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    renderUI(["/"]);

    await waitFor(() => {
      expect(mockGetSessions).toHaveBeenCalled();
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "안녕하세요");
    await user.click(screen.getByRole("button", { name: /전송|보내기|send|시작/i }));

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({ message: "안녕하세요" });
    });
  });
});
