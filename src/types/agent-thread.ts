import type { ChatMessage } from "@/src/types/chat";
import type { AgentRole } from "@/src/types/chat";

export type AgentThread = {
  id: string;
  role: AgentRole;
  title: string;
  conversationId: string;
  messages: ChatMessage[];
  updatedAt: string;
};
