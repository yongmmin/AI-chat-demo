import { useState } from "react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  buttonSize?: "btn-md" | "btn-lg";
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "메시지를 입력하세요...",
  className = "",
  buttonSize = "btn-md",
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend();
  };

  const isEmpty = !input.trim();

  return (
    <div className={`chat-input-row ${className}`}>
      <input
        className="chat-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        className={`btn btn-primary ${buttonSize}`}
        aria-label="전송"
        onClick={handleSend}
        disabled={disabled || isEmpty}
      >
        전송
      </button>
    </div>
  );
}
