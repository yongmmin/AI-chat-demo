import type { SSEStreamingApi } from "hono/streaming";
import type { Session } from "./types.js";
import { streamScenarios } from "./store.js";
import { writeSSE, saveAssistantMessage } from "./helpers.js";

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant in a chat interface with a code/document preview panel.
When providing code, documents, or structured content, always use markdown code blocks with a language tag.
First give a brief text explanation (1-3 sentences), then provide the content in a code block.
Keep responses concise. Respond in the same language as the user.`;

const STYLE_PROMPTS: Record<string, string> = {
  formal: "Always respond in a formal, professional tone.",
  casual: "Always respond in a casual, friendly, and conversational tone.",
  bullet: "Always format your response primarily using bullet points or numbered lists.",
};

function buildSystemPrompt(style?: string): string {
  const styleInstruction = style && STYLE_PROMPTS[style];
  return styleInstruction
    ? `${BASE_SYSTEM_PROMPT}\n\n${styleInstruction}`
    : BASE_SYSTEM_PROMPT;
}

export function hasOpenRouterKey(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  return !!process.env.OPENROUTER_API_KEY;
}

export async function streamFromOpenRouter(session: Session, stream: SSEStreamingApi): Promise<void> {
  const chatMessages = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";

  let response: globalThis.Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(session.style) },
          ...chatMessages,
        ],
        stream: true,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await writeSSE(stream, { type: "text_delta", content: `AI 연결 실패: ${message}` });
    await writeSSE(stream, { type: "done" });
    return;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    await writeSSE(stream, {
      type: "text_delta",
      content: `AI 응답 실패 (${response.status}): ${errText.slice(0, 200)}`,
    });
    await writeSSE(stream, { type: "done" });
    return;
  }

  let inCodeBlock = false;
  let codeBlockLang = "";
  let lineBuffer = "";
  let sseBuffer = "";
  let assistantText = "";
  let artifactContent = "";
  let artifactLanguage: string | undefined;

  async function processLine(line: string): Promise<void> {
    const fenceMatch = line.match(/^```(\w*)\s*$/);

    if (fenceMatch && !inCodeBlock) {
      inCodeBlock = true;
      codeBlockLang = fenceMatch[1] || "";
      if (codeBlockLang) artifactLanguage = codeBlockLang;
      return;
    }
    if (inCodeBlock && line.trimEnd() === "```") {
      inCodeBlock = false;
      return;
    }

    const content = line + "\n";
    if (inCodeBlock) {
      artifactContent += content;
      await writeSSE(stream, {
        type: "artifact_delta",
        content,
        ...(codeBlockLang && { language: codeBlockLang }),
      });
    } else if (content.trim()) {
      assistantText += content;
      await writeSSE(stream, { type: "text_delta", content });
    }
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const sseLines = sseBuffer.split("\n");
      sseBuffer = sseLines.pop() || "";

      for (const sseLine of sseLines) {
        if (!sseLine.startsWith("data: ")) continue;
        const data = sseLine.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const content = JSON.parse(data).choices?.[0]?.delta?.content;
          if (!content) continue;

          lineBuffer += content;
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() || "";
          for (const l of lines) await processLine(l);
        } catch {
          // ignore upstream parse errors
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await writeSSE(stream, { type: "text_delta", content: `\n[스트림 중단: ${message}]` });
  }

  if (lineBuffer.trim()) await processLine(lineBuffer);

  saveAssistantMessage(session, {
    text: assistantText,
    artifact: artifactContent || undefined,
    language: artifactLanguage,
  });

  await writeSSE(stream, { type: "done" });
}

export async function streamFromScenario(session: Session, stream: SSEStreamingApi): Promise<void> {
  const lastUserMsg = [...session.messages].reverse().find((m) => m.role === "user");
  const matchKey = Object.keys(streamScenarios).find(
    (key) => key !== "_default" && lastUserMsg?.content?.includes(key),
  );
  const scenario = streamScenarios[matchKey!] || streamScenarios["_default"];

  let assistantText = "";
  let artifactContent = "";
  let artifactLanguage: string | undefined;
  const delayMs = scenario.delayMs || 100;

  for (const event of scenario.events) {
    if (event.type === "text_delta") assistantText += event.content;
    else if (event.type === "artifact_delta") {
      artifactContent += event.content;
      if (event.language) artifactLanguage = event.language;
    }

    await writeSSE(stream, event);

    if (event.type === "done") {
      saveAssistantMessage(session, {
        text: assistantText,
        artifact: artifactContent || undefined,
        language: artifactLanguage,
      });
      if (event.title && !session.title) session.title = event.title;
    } else {
      await stream.sleep(delayMs);
    }
  }
}
