export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  artifact?: { content: string; language?: string };
}

export type ResponseStyle = "normal" | "formal" | "casual" | "bullet";

export interface Session {
  id: string;
  title: string | null;
  created_at: string;
  messages: Message[];
  style?: ResponseStyle;
}

export interface StreamEvent {
  type: "text_delta" | "artifact_delta" | "done";
  content?: string;
  language?: string;
  title?: string;
}

export interface StreamScenario {
  events: StreamEvent[];
  delayMs?: number;
}
