import { useCallback, useEffect, useState } from "react";
import { getSessions } from "../remotes";
import type { ChatSession } from "../types/api";

export function useSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const refetch = useCallback(() => {
    getSessions().then((data) => setSessions(data.sessions));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { sessions, refetch };
}
