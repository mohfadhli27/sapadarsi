import type { ChatMessage, ChatPhase } from "@/src/types/chat";

export type SsePatientMessage = {
  id: number;
  role: ChatMessage["role"];
  text: string;
  senderName?: string;
  createdAt: string | Date;
  isTakeover?: boolean;
  suggestNewConsultation?: ChatMessage["suggestNewConsultation"];
};

function normalizeMessageContent(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function messageContentKey(m: { role: ChatMessage["role"]; content: string }): string {
  return `${m.role}:${normalizeMessageContent(m.content)}`;
}

export function sseToChatMessage(m: SsePatientMessage, phase: ChatPhase): ChatMessage {
  const createdAt =
    m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt);
  return {
    id: `db-${m.id}`,
    role: m.role,
    content: (m.text ?? "").trim(),
    timestamp: new Date(createdAt),
    phase,
    senderName: m.senderName,
    suggestNewConsultation: m.suggestNewConsultation,
  };
}

/** Gabungkan pesan SSE sesi aktif ke riwayat thread tanpa menunggu refetch API. */
export function mergeLiveSessionMessages(
  currentMessages: ChatMessage[],
  sseMessages: SsePatientMessage[],
  phase: ChatPhase
): ChatMessage[] {
  const incoming = sseMessages.map((m) => sseToChatMessage(m, phase));
  if (incoming.length === 0) return currentMessages;

  let dividerIndex = -1;
  for (let i = currentMessages.length - 1; i >= 0; i--) {
    if (currentMessages[i].kind === "session_divider") {
      dividerIndex = i;
      break;
    }
  }

  if (dividerIndex >= 0) {
    return [...currentMessages.slice(0, dividerIndex + 1), ...incoming];
  }

  const incomingIds = new Set(incoming.map((m) => m.id));
  const incomingContentKeys = new Set(incoming.map(messageContentKey));

  const optimistic = currentMessages.filter((m) => {
    if (!m.id.startsWith("msg-") && !m.id.startsWith("err-")) return false;
    if (incomingIds.has(m.id)) return false;
    // Pesan optimistik (msg-*) yang sudah ada di DB via SSE — jangan tampilkan dua kali
    if (m.id.startsWith("msg-") && incomingContentKeys.has(messageContentKey(m))) {
      return false;
    }
    return true;
  });

  return [...incoming, ...optimistic];
}
