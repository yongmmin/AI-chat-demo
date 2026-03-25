import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { registerRoutes } from "./routes.js";
import { sessions, sessionsData, resetSessions } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const app = new Hono().basePath("/api");

app.use("*", cors());
registerRoutes(app);

// ─── Start ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  const PORT = 3100;
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`${sessions.length} sessions loaded`);
  });
}

export { app, sessions, sessionsData, resetSessions };
