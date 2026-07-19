"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createAgentThread,
  loadAgentThreads,
  saveAgentThreads,
} from "@/src/lib/agent-thread-storage";
import type { AgentThread } from "@/src/types/agent-thread";
import type { AgentRole, ChatMessage } from "@/src/types/chat";

export function useAgentThreads(patientId: number | undefined, role: AgentRole) {
  const [threads, setThreads] = useState<AgentThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!patientId) {
      setThreads([]);
      setActiveThreadId(null);
      return;
    }
    const loaded = loadAgentThreads(patientId, role);
    setThreads(loaded);
    setActiveThreadId((current) => {
      if (current && loaded.some((t) => t.id === current)) return current;
      return loaded[0]?.id ?? null;
    });
  }, [patientId, role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persist = useCallback(
    (next: AgentThread[]) => {
      if (!patientId) return;
      const sorted = [...next].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      saveAgentThreads(patientId, role, sorted);
      setThreads(sorted);
    },
    [patientId, role]
  );

  const activeThread =
    threads.find((t) => t.id === activeThreadId) ?? null;

  const startNewThread = useCallback(() => {
    const thread = createAgentThread(role);
    persist([thread, ...threads]);
    setActiveThreadId(thread.id);
    return thread;
  }, [persist, role, threads]);

  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
  }, []);

  const syncThreadMessages = useCallback(
    (threadId: string, messages: ChatMessage[]) => {
      if (!patientId) return;
      const firstUser = messages.find((m) => m.role === "user");
      const title = firstUser?.content?.slice(0, 48) || "Chat baru";
      const next = threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages,
              title,
              updatedAt: new Date().toISOString(),
            }
          : t
      );
      persist(next);
    },
    [patientId, persist, threads]
  );

  const ensureActiveThread = useCallback(() => {
    if (activeThread) return activeThread;
    return startNewThread();
  }, [activeThread, startNewThread]);

  return {
    threads,
    activeThread,
    activeThreadId,
    startNewThread,
    selectThread,
    syncThreadMessages,
    ensureActiveThread,
    refresh,
  };
}
