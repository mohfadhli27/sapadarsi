import type { AgentThread } from "@/src/types/agent-thread";
import type { AgentRole } from "@/src/types/chat";

const STORAGE_PREFIX = "darsi-agent-threads";

function storageKey(patientId: number, role: AgentRole) {
  return `${STORAGE_PREFIX}:${patientId}:${role}`;
}

export function loadAgentThreads(
  patientId: number,
  role: AgentRole
): AgentThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(patientId, role));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentThread[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((thread) => ({
      ...thread,
      messages: thread.messages.map((message) => ({
        ...message,
        timestamp: new Date(message.timestamp),
      })),
    }));
  } catch {
    return [];
  }
}

export function saveAgentThreads(
  patientId: number,
  role: AgentRole,
  threads: AgentThread[]
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(patientId, role), JSON.stringify(threads));
}

export function createAgentThread(role: AgentRole, title = "Chat baru"): AgentThread {
  const id = crypto.randomUUID();
  return {
    id,
    role,
    title,
    conversationId: `${role}-${id}`,
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}
