import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { getSessions, deleteSession } from "../remotes";
import type { ChatSession } from "../types/api";

export default function ChatHistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    getSessions().then((data) => setSessions(data.sessions));
  }, []);

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="history-container">
      <h1 className="history-title">채팅 기록</h1>

      <div className="history-list">
        {sessions.length === 0 && (
          <p className="history-empty">대화 기록이 없습니다</p>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="history-card">
            <span
              className="history-card-title"
              onClick={() => navigate(`/chat/${s.id}`)}
            >
              {s.title ?? s.lastMessage}
            </span>
            <button
              className="btn btn-danger btn-sm"
              aria-label="삭제"
              onClick={() => handleDelete(s.id)}
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <Link to="/" className="history-back-link">
        ← 홈으로
      </Link>
    </div>
  );
}
