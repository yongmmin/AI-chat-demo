import { Link, useNavigate, useParams } from "react-router";
import type { ChatSession } from "../types/api";

interface SidebarProps {
  sessions: ChatSession[];
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SidebarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

export default function Sidebar({ sessions, onNewChat, isOpen, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const { id: activeId } = useParams<{ id: string }>();

  if (!isOpen) {
    return (
      <aside className="sidebar sidebar-mini">
        <div className="sidebar-mini-top">
          <button
            className="btn btn-ghost sidebar-icon-btn"
            onClick={onToggle}
            aria-label="사이드바 열기"
          >
            <SidebarIcon />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="btn btn-primary btn-md sidebar-new-btn" onClick={onNewChat}>
          + 새 대화
        </button>
        <button
          className="btn btn-ghost sidebar-icon-btn"
          onClick={onToggle}
          aria-label="사이드바 닫기"
        >
          <SidebarIcon />
        </button>
      </div>

      <nav className="sidebar-sessions">
        {sessions.length === 0 && (
          <p className="sidebar-empty">대화가 없습니다</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            className={`sidebar-session-item ${s.id === activeId ? "sidebar-session-active" : ""}`}
            onClick={() => navigate(`/chat/${s.id}`)}
          >
            <span className="sidebar-session-title">
              {s.title ?? s.lastMessage}
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link to="/history" className="btn btn-secondary btn-md sidebar-history-link">
          전체 기록 보기 →
        </Link>
      </div>
    </aside>
  );
}
