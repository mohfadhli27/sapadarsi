"use client";

import { useMemo, useState } from "react";
import { Pill, Plus, Search } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import type { PharmacyThread } from "@/src/hooks/use-pharmacy-threads";
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

function threadTitle(thread: PharmacyThread) {
  const title = thread.title?.trim() || "Chat apotek";
  return title.length > 48 ? `${title.slice(0, 48)}…` : title;
}

type Props = {
  threads: PharmacyThread[];
  selectedSessionId: number | null;
  loading?: boolean;
  onSelectSession: (sessionId: number) => void;
  onNewChat: () => void;
  inDrawer?: boolean;
  onClose?: () => void;
};

export function PatientPharmacySidebar({
  threads,
  selectedSessionId,
  loading = false,
  onSelectSession,
  onNewChat,
  inDrawer = false,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => threadTitle(t).toLowerCase().includes(q));
  }, [threads, query]);

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col",
        inDrawer ? "bg-background" : "border-r bg-muted/15 md:w-72 md:shrink-0 lg:w-80"
      )}
    >
      <div className={cn("border-b p-3", inDrawer && "border-border/60 bg-background")}>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start gap-2 rounded-xl border-blue-500/30 text-blue-800 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-950/40",
            inDrawer ? "border-border bg-muted/40" : "border-dashed"
          )}
          onClick={() => {
            onNewChat();
            onClose?.();
          }}
        >
          <Plus className="h-4 w-4" />
          Chat baru
        </Button>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari riwayat chat..."
            className="h-9 w-full rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
          />
        </div>
      </div>

      <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {loading && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">Memuat riwayat...</p>
        )}

        {!loading && filtered.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {query ? "Chat tidak ditemukan" : "Belum ada riwayat chat apotek"}
          </p>
        )}

        <ul className="space-y-0.5">
          {filtered.map((thread) => {
            const selected = selectedSessionId === thread.id;

            return (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(thread.id);
                    onClose?.();
                  }}
                  className={cn(
                    "w-full rounded-xl px-3 py-3 text-left transition-colors",
                    selected
                      ? "bg-blue-500/10 ring-1 ring-blue-500/25"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        selected ? "bg-blue-600 text-white" : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      )}
                    >
                      <Pill className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{threadTitle(thread)}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {thread.messageCount} pesan · {formatRelative(thread.updatedAt)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
