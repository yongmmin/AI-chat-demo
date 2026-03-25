import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSession } from "../remotes";
import type { ChatSessionDetail, Message } from "../types/api";
import { useChatStream } from "../hooks/useChatStream";
import MessageBubble from "../components/MessageBubble";
import ArtifactPreview from "../components/ArtifactPreview";
import ChatInput from "../components/ChatInput";

type ResponseStyle = "formal" | "casual" | "bullet";

const STYLE_OPTIONS: { value: ResponseStyle; label: string }[] = [
  { value: "formal", label: "격식체" },
  { value: "casual", label: "구어체" },
  { value: "bullet", label: "목록형" },
];

export default function ChatSessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<ChatSessionDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<ResponseStyle | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSession = () => {
    if (!id) return;
    setError(null);
    getSession(id)
      .then((data) => {
        setSession(data);
        setMessages(data.messages);
      })
      .catch(() => setError("세션을 불러올 수 없습니다."));
  };

  const { streamText, artifactText, artifactLanguage, isStreaming, send, close } =
    useChatStream(id, loadSession);

  useEffect(() => {
    loadSession();
    return () => close();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, artifactText]);

  const handleSend = async (content: string) => {
    if (!id) return;
    await send(content, (optimisticMsg) => {
      setMessages((prev) => [...prev, optimisticMsg]);
    }, ...(style ? [style] : []) as []);
  };

  const lastArtifact = [...messages].reverse().find((m) => m.artifact)?.artifact;
  const hasPreview = !!(artifactText || lastArtifact);

  return (
    <div className="chat-page">
      <div className="chat-area">
        <div className="chat-header">
          <h2 className="chat-title">
            {session?.title || <span className="chat-title-empty">제목 없음</span>}
          </h2>
          <select
            className="chat-style-select"
            value={style ?? ""}
            onChange={(e) => setStyle(e.target.value as ResponseStyle || undefined)}
            disabled={isStreaming}
            aria-label="답변 스타일"
          >
            <option value="" disabled>답변 스타일</option>
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="chat-messages">
          {error && (
            <div className="chat-error">
              <p>{error}</p>
              <button className="btn btn-secondary btn-sm" onClick={loadSession}>
                다시 시도
              </button>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {isStreaming && !streamText && (
            <p className="chat-loading">답변 생성 중...</p>
          )}
          {streamText && (
            <div className="message message-assistant">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown>
              {isStreaming && <span className="typing-cursor" />}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-wrapper">
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>
      </div>

      {/* 슬라이드 프리뷰 패널 */}
      <div className={`chat-preview-panel ${hasPreview ? "chat-preview-open" : ""}`}>
        {artifactText ? (
          <ArtifactPreview content={artifactText} language={artifactLanguage} />
        ) : lastArtifact ? (
          <ArtifactPreview
            content={lastArtifact.content}
            language={lastArtifact.language}
          />
        ) : null}
      </div>
    </div>
  );
}
