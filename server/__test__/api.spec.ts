import { describe, it, expect, beforeEach } from "vitest";
import { app, resetSessions } from "../index.js";

beforeEach(() => {
  resetSessions();
});

const BASE = "http://localhost/api";

async function get(path: string) {
  return app.request(`${BASE}${path}`);
}

async function post(path: string, body: unknown) {
  return app.request(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function del(path: string) {
  return app.request(`${BASE}${path}`, { method: "DELETE" });
}

// ─── Health ─────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  it("서버 상태를 반환한다", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.sessions).toBeGreaterThan(0);
  });
});

// ─── Sessions CRUD ──────────────────────────────────────────────────
describe("GET /api/sessions", () => {
  it("세션 목록을 반환한다", async () => {
    const res = await get("/sessions");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toBeInstanceOf(Array);
    expect(body.sessions.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it("각 세션에 id, title, createdAt, lastMessage가 있다", async () => {
    const res = await get("/sessions");
    const body = await res.json();
    const session = body.sessions[0];
    expect(session).toHaveProperty("id");
    expect(session).toHaveProperty("title");
    expect(session).toHaveProperty("createdAt");
    expect(session).toHaveProperty("lastMessage");
  });

  it("페이지네이션이 동작한다", async () => {
    const res = await get("/sessions?page=1&limit=2");
    const body = await res.json();
    expect(body.sessions.length).toBeLessThanOrEqual(2);
  });
});

describe("GET /api/sessions/:id", () => {
  it("세션 상세를 반환한다", async () => {
    const list = await (await get("/sessions")).json();
    const id = list.sessions[0].id;

    const res = await get(`/sessions/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.messages).toBeInstanceOf(Array);
  });

  it("상세 응답은 camelCase 필드를 사용한다 (createdAt)", async () => {
    const list = await (await get("/sessions")).json();
    const id = list.sessions[0].id;

    const res = await get(`/sessions/${id}`);
    const body = await res.json();
    expect(body).toHaveProperty("createdAt");
    expect(body).not.toHaveProperty("created_at");
  });

  it("존재하지 않는 세션은 404를 반환한다", async () => {
    const res = await get("/sessions/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/sessions", () => {
  it("새 세션을 생성한다", async () => {
    const res = await post("/sessions", { message: "안녕하세요" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
  });

  it("빈 메시지는 400을 반환한다", async () => {
    const res = await post("/sessions", { message: "" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("400 에러는 {error} 포맷이다", async () => {
    const res = await post("/sessions", { message: "" });
    const body = await res.json();
    expect(body.error).toBe("Message is required");
    expect(body).not.toHaveProperty("message");
  });

  it("500 에러는 {message} 포맷이다", async () => {
    const res = await post("/sessions", { message: "__trigger_500__" });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("Internal server error");
    expect(body).not.toHaveProperty("error");
  });

  it("생성된 세션이 목록에 나타난다", async () => {
    const created = await (await post("/sessions", { message: "테스트 세션" })).json();
    const list = await (await get("/sessions")).json();
    const ids = list.sessions.map((s: { id: string }) => s.id);
    expect(ids).toContain(created.id);
  });
});

describe("DELETE /api/sessions/:id", () => {
  it("세션을 삭제한다", async () => {
    const list = await (await get("/sessions")).json();
    const id = list.sessions[0].id;

    const res = await del(`/sessions/${id}`);
    expect(res.status).toBe(204);

    const after = await get(`/sessions/${id}`);
    expect(after.status).toBe(404);
  });

  it("존재하지 않는 세션 삭제는 404를 반환한다", async () => {
    const res = await del("/sessions/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/sessions/:id/messages", () => {
  it("메시지를 추가한다", async () => {
    const list = await (await get("/sessions")).json();
    const id = list.sessions[0].id;

    const res = await post(`/sessions/${id}/messages`, { content: "새 메시지" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
  });

  it("추가된 메시지가 세션 상세에 포함된다", async () => {
    const list = await (await get("/sessions")).json();
    const id = list.sessions[0].id;

    await post(`/sessions/${id}/messages`, { content: "추가 메시지" });

    const detail = await (await get(`/sessions/${id}`)).json();
    const contents = detail.messages.map((m: { content: string }) => m.content);
    expect(contents).toContain("추가 메시지");
  });

  it("빈 content는 400을 반환한다", async () => {
    const list = await (await get("/sessions")).json();
    const id = list.sessions[0].id;

    const res = await post(`/sessions/${id}/messages`, { content: "" });
    expect(res.status).toBe(400);
  });
});

// ─── SSE Stream ─────────────────────────────────────────────────────
describe("GET /api/sessions/:id/stream", () => {
  it("SSE 스트림을 반환한다", async () => {
    const list = await (await get("/sessions")).json();
    const id = list.sessions[0].id;

    await post(`/sessions/${id}/messages`, { content: "안녕" });

    const res = await get(`/sessions/${id}/stream`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain("event:");
    expect(text).toContain("data:");
  }, 10000);

  it("존재하지 않는 세션은 404를 반환한다", async () => {
    const res = await get("/sessions/nonexistent/stream");
    expect(res.status).toBe(404);
  });
});
