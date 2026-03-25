import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { createSession } from "../remotes";
import type { SidebarOutletContext } from "./Routes";
import ChatInput from "../components/ChatInput";

const QUICK_TABS = [
  "회의록 정리해줘",
  "이메일 초안 작성해줘",
  "코드 리뷰 해줘",
  "데이터 요약해줘",
  "번역해줘",
  "아이디어 브레인스토밍",
];

export default function ChatHomePage() {
  const navigate = useNavigate();
  const { refetchSessions } = useOutletContext<SidebarOutletContext>();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (message: string) => {
    if (isCreating) return;
    setError(null);
    setIsCreating(true);
    try {
      const { id } = await createSession({ message });
      refetchSessions();
      navigate(`/chat/${id}`);
    } catch (err: unknown) {
      const e = err as { error?: string; message?: string };
      setError(e.error || e.message || "오류가 발생했습니다");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="home-container">
      <h1 className="home-title">AI Chat</h1>

      <div className="quick-tabs">
        {QUICK_TABS.map((tab) => (
          <button
            key={tab}
            className="quick-tab-card"
            onClick={() => handleCreate(tab)}
            disabled={isCreating}
          >
            {tab}
          </button>
        ))}
      </div>

      <ChatInput
        onSend={handleCreate}
        disabled={isCreating}
        className="home-input-row"
        buttonSize="btn-lg"
      />

      {error && <p className="home-error">{error}</p>}
    </div>
  );
}
