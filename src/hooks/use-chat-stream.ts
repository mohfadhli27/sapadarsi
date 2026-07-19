"use client";

import { useCallback } from "react";
import { useChatStore } from "@/src/stores/chat-store";
import { useAuthStore } from "@/src/stores/auth-store";
import { parseNDJSONStream } from "@/src/lib/stream-parser";
import { sanitizePharmacyResponse } from "@/src/lib/pharmacy-response-format";
import type { AgentRole, ChatMessage } from "@/src/types/chat";

type SendOptions = {
  conversationId?: string;
  sessionId?: number;
  onComplete?: (messages: ChatMessage[]) => void;
};

export function useChatStream() {
  const {
    addMessage,
    setStreaming,
    appendStreamText,
    replaceStreamText,
    commitStream,
    messages,
  } = useChatStore();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const sendMessage = useCallback(
    async (content: string, role: AgentRole, options?: SendOptions) => {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        phase: "triage",
      };

      addMessage(userMsg);
      setStreaming(true);

      const history = [...messages, userMsg]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ id: m.id, role: m.role, content: m.content }));

      try {
        const res = await fetch(`/api/chat?role=${role}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messages: history,
            conversationId: options?.conversationId,
            sessionId: options?.sessionId,
            patient: user
              ? {
                  patientId: user.patientId,
                  name: user.name,
                  noRm: user.medicalRecordNumber,
                }
              : undefined,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error("Gagal menghubungi server");
        }

        const reader = res.body.getReader();

        for await (const event of parseNDJSONStream(reader)) {
          if (event.type === "text-delta") {
            const text = event.text || event.delta || "";
            appendStreamText(text);
          } else if (event.type === "text-replace") {
            replaceStreamText(event.text || "");
          }
        }

        const rawText = useChatStore.getState().streamingText;
        const finalText =
          role === "apoteker" ? sanitizePharmacyResponse(rawText) : rawText;

        if (role === "apoteker" && finalText !== rawText) {
          replaceStreamText(finalText);
        }

        commitStream();

        if (!finalText.trim()) {
          addMessage({
            id: `err-${Date.now()}`,
            role: "system",
            content:
              "Maaf, tidak ada respons dari apoteker. Silakan coba lagi dalam beberapa saat.",
            timestamp: new Date(),
            phase: "triage",
          });
        }

        const latest = useChatStore.getState().messages;
        options?.onComplete?.(
          latest.filter((m) => m.role === "user" || m.role === "assistant")
        );
      } catch (error) {
        commitStream();
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "system",
          content:
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan. Silakan coba lagi.",
          timestamp: new Date(),
          phase: "triage",
        };
        addMessage(errMsg);
        options?.onComplete?.(useChatStore.getState().messages);
      } finally {
        setStreaming(false);
      }
    },
    [addMessage, appendStreamText, replaceStreamText, commitStream, messages, setStreaming, token, user]
  );

  return { sendMessage };
}
