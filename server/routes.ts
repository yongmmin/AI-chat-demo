import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { sessions } from "./store.js";
import { generateId, getSessionSummary, writeSSE } from "./helpers.js";
import {
  hasOpenRouterKey,
  streamFromOpenRouter,
  streamFromScenario,
} from "./stream.js";
import type { Session } from "./types.js";

export function registerRoutes(app: Hono) {
  // ─── GET /api/sessions ───────────────────────────────────────────────
  app.get("/sessions", (c) => {
    const page = Math.max(1, parseInt(c.req.query("page") || "") || 1);
    const limit = Math.max(1, parseInt(c.req.query("limit") || "") || 10);

    const sorted = [...sessions].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const start = (page - 1) * limit;
    const paginated = sorted.slice(start, start + limit);

    return c.json({
      sessions: paginated.map(getSessionSummary),
      total: sessions.length,
    });
  });

  // ─── GET /api/sessions/:id ───────────────────────────────────────────
  app.get("/sessions/:id", (c) => {
    const session = sessions.find((s) => s.id === c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    return c.json({
      id: session.id,
      title: session.title,
      createdAt: session.created_at,
      messages: session.messages,
    });
  });

  // ─── POST /api/sessions ─────────────────────────────────────────────
  app.post("/sessions", async (c) => {
    const { message } = await c.req.json();

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return c.json({ error: "Message is required" }, 400);
    }

    if (message.toLowerCase().includes("__trigger_500__")) {
      return c.json({ message: "Internal server error" }, 500);
    }

    const newSession: Session = {
      id: generateId(),
      title: null,
      created_at: new Date().toISOString(),
      messages: [
        {
          id: generateId(),
          role: "user",
          content: message.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    };

    sessions.unshift(newSession);
    return c.json({ id: newSession.id }, 201);
  });

  // ─── DELETE /api/sessions/:id ────────────────────────────────────────
  app.delete("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) return c.json({ error: "Session not found" }, 404);

    const filtered = sessions.filter((s) => s.id !== id);
    sessions.length = 0;
    sessions.push(...filtered);
    return c.body(null, 204);
  });

  // ─── POST /api/sessions/:id/messages ─────────────────────────────────
  app.post("/sessions/:id/messages", async (c) => {
    const session = sessions.find((s) => s.id === c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    const { content, style } = await c.req.json();
    if (!content || typeof content !== "string") {
      return c.json({ error: "Content is required" }, 400);
    }

    if (style) session.style = style;

    const userMsg = {
      id: generateId(),
      role: "user" as const,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    session.messages.push(userMsg);
    return c.json({ id: userMsg.id }, 201);
  });

  // ─── GET /api/sessions/:id/stream (SSE) ──────────────────────────────
  app.get("/sessions/:id/stream", (c) => {
    const session = sessions.find((s) => s.id === c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    return streamSSE(c, async (stream) => {
      if (hasOpenRouterKey()) {
        try {
          await streamFromOpenRouter(session, stream);
        } catch (err) {
          console.error("OpenRouter stream error:", err);
          await writeSSE(stream, {
            type: "text_delta",
            content: "AI 응답 중 오류 발생",
          });
          await writeSSE(stream, { type: "done" });
        }
      } else {
        await streamFromScenario(session, stream);
      }
    });
  });

  // ─── Health check ────────────────────────────────────────────────────
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      sessions: sessions.length,
      ai: hasOpenRouterKey() ? "openrouter" : "scenario-fallback",
    });
  });
}
