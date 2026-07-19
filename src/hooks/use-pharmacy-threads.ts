"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizePharmacyResponse } from "@/src/lib/pharmacy-response-format";
import type { ChatMessage } from "@/src/types/chat";
import type { PharmacyReceiptMeta } from "@/src/types/pharmacy-receipt";

export type PharmacyThread = {
  id: number;
  title: string;
  updatedAt: string;
  messageCount: number;
};

function parsePharmacyReceipt(toolResults: unknown): PharmacyReceiptMeta | null {
  if (!toolResults || typeof toolResults !== "object") return null;
  const receipt = (toolResults as { pharmacyReceipt?: PharmacyReceiptMeta }).pharmacyReceipt;
  if (!receipt?.orderId || !receipt.receiptNo) return null;
  return receipt;
}

function mapDbMessages(
  raw: Array<{
    id: number;
    sender_type: string;
    message_text: string;
    created_at: string;
    tool_results?: unknown;
  }>,
  sessionId?: number
): ChatMessage[] {
  return raw.map((m) => {
    const receipt = parsePharmacyReceipt(m.tool_results);
    const base = {
      id: `db-${m.id}`,
      dbMessageId: m.id,
      timestamp: new Date(m.created_at),
      phase: "triage" as const,
      sessionId,
    };

    if (receipt) {
      return {
        ...base,
        role: "assistant" as const,
        content: m.message_text,
        kind: "pharmacy_receipt" as const,
        pharmacyReceipt: receipt,
      };
    }

    return {
      ...base,
      role: m.sender_type === "patient" ? ("user" as const) : ("assistant" as const),
      content:
        m.sender_type === "patient"
          ? m.message_text
          : sanitizePharmacyResponse(m.message_text),
      kind: "message" as const,
    };
  });
}

export function usePharmacyThreads(patientId: number | undefined) {
  const [threads, setThreads] = useState<PharmacyThread[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const activeSessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const loadThreads = useCallback(async () => {
    if (!patientId || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await fetch(`/api/pharmacy/sessions?patientId=${patientId}`);
      if (!res.ok) return;
      const data = await res.json();
      const sessions: PharmacyThread[] = data.sessions ?? [];
      setThreads(sessions);
      return sessions;
    } finally {
      loadingRef.current = false;
    }
  }, [patientId]);

  const loadMessages = useCallback(
    async (sessionId: number) => {
      if (!patientId) return [];
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pharmacy/sessions/${sessionId}/messages?patientId=${patientId}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        const msgs = mapDbMessages(data.messages ?? [], sessionId);
        if (activeSessionIdRef.current === sessionId) {
          setSessionMessages(msgs);
        }
        return msgs;
      } finally {
        setLoading(false);
      }
    },
    [patientId]
  );

  const createNewSession = useCallback(async () => {
    if (!patientId) return null;
    const res = await fetch("/api/pharmacy/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newId = data.session?.id as number;

    setThreads((prev) => [
      { id: newId, title: "Chat baru", updatedAt: new Date().toISOString(), messageCount: 0 },
      ...prev,
    ]);
    setActiveSessionId(newId);
    setSessionMessages([]);
    return newId;
  }, [patientId]);

  const selectThread = useCallback(
    async (sessionId: number) => {
      setActiveSessionId(sessionId);
      return loadMessages(sessionId);
    },
    [loadMessages]
  );

  const reloadActiveMessages = useCallback(async () => {
    const sid = activeSessionIdRef.current;
    if (!sid) return [];
    return loadMessages(sid);
  }, [loadMessages]);

  const refreshAfterMessage = useCallback(async () => {
    if (!patientId) return [];
    await loadThreads();
    return reloadActiveMessages();
  }, [patientId, loadThreads, reloadActiveMessages]);

  const deleteMessage = useCallback(
    async (messageId: number) => {
      const sid = activeSessionIdRef.current;
      if (!patientId || !sid) return false;

      const res = await fetch(
        `/api/pharmacy/sessions/${sid}/messages/${messageId}?patientId=${patientId}`,
        { method: "DELETE" }
      );
      if (!res.ok) return false;

      setSessionMessages((prev) => prev.filter((m) => m.dbMessageId !== messageId));
      await loadThreads();
      return true;
    },
    [patientId, loadThreads]
  );

  const deleteSession = useCallback(
    async (sessionId: number) => {
      if (!patientId) return null;

      const res = await fetch(
        `/api/pharmacy/sessions/${sessionId}?patientId=${patientId}`,
        { method: "DELETE" }
      );
      if (!res.ok) return null;

      let remaining: PharmacyThread[] = [];
      setThreads((prev) => {
        remaining = prev.filter((t) => t.id !== sessionId);
        return remaining;
      });

      if (activeSessionIdRef.current === sessionId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          setActiveSessionId(next.id);
          return loadMessages(next.id);
        }
        setActiveSessionId(null);
        setSessionMessages([]);
        return [];
      }

      return null;
    },
    [patientId, loadMessages]
  );

  useEffect(() => {
    if (!patientId) {
      setThreads([]);
      setActiveSessionId(null);
      setSessionMessages([]);
      return;
    }

    void loadThreads().then((sessions) => {
      if (sessions && sessions.length > 0) {
        const first = sessions[0];
        setActiveSessionId(first.id);
        void loadMessages(first.id);
      }
    });
  }, [patientId, loadThreads, loadMessages]);

  const activeThread = threads.find((t) => t.id === activeSessionId) ?? null;

  return {
    threads,
    activeThread,
    activeSessionId,
    sessionMessages,
    loading,
    createNewSession,
    selectThread,
    refreshAfterMessage,
    reloadActiveMessages,
    deleteMessage,
    deleteSession,
    loadThreads,
  };
}
