import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { Session, StreamScenario } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const sessionsData: Session[] = JSON.parse(
  readFileSync(join(__dirname, "data/sessions.json"), "utf-8"),
);

export const streamScenarios: Record<string, StreamScenario> = JSON.parse(
  readFileSync(join(__dirname, "data/streamScenarios.json"), "utf-8"),
);

export let sessions = structuredClone(sessionsData);

/** 테스트용: in-memory 세션을 초기 상태로 리셋 */
export function resetSessions(): void {
  sessions = structuredClone(sessionsData);
}
