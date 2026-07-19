"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

function formatRelative(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export type SidebarThread = {
  id: number;
  title: string;
  updatedAt: string;
};

type Props = {
  threads: SidebarThread[];
  activeThreadId: number | null;
  agentLabel: string;
  onSelect: (threadId: number) => void;
  onNewChat: () => void;
};

export function PatientAgentSidebar({
  threads,
  activeThreadId,
  agentLabel,
  onSelect,
  onNewChat,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col border-r bg-muted/20">
      <div className="border-b p-3">
        <Button
          type="button"
          className="h-10 w-full justify-start gap-2 rounded-xl"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          Chat baru
        </Button>
      </div>

      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span>Riwayat {agentLabel}</span>
        </div>
      </div>

      <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Belum ada riwayat chat
          </p>
        ) : (
          <div className="space-y-1">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelect(thread.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                  thread.id === activeThreadId
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-accent/60"
                )}
              >
                <p className="truncate text-sm font-medium">{thread.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {formatRelative(thread.updatedAt)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
