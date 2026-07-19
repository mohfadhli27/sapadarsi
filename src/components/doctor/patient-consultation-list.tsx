"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { History, Plus } from "lucide-react";
import type { ConsultationListItem } from "@/src/hooks/use-doctor-consultation-chat";

const PHASE_LABEL: Record<string, string> = {
  triage: "Triase",
  selecting_doctor: "Pilih dokter",
  waiting: "Menunggu dokter",
  live: "Berlangsung",
  closed: "Selesai",
  rejected: "Ditolak",
};

const PHASE_COLOR: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800",
  live: "bg-emerald-100 text-emerald-800",
  closed: "bg-muted text-muted-foreground",
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  activeSessionId: number | null;
  onSelect: (sessionId: number) => void;
  onNew: () => void;
  loadList: () => Promise<ConsultationListItem[]>;
};

export function PatientConsultationList({
  activeSessionId,
  onSelect,
  onNew,
  loadList,
}: Props) {
  const [items, setItems] = useState<ConsultationListItem[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await loadList());
  }, [loadList]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const active = items.find((i) => i.sessionId === activeSessionId);

  return (
    <div className="border-b bg-gradient-to-r from-emerald-500/5 to-transparent px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium"
          onClick={() => setOpen((v) => !v)}
        >
          <History className="h-4 w-4 text-primary" />
          Riwayat Konsultasi
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </button>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" />
          Konsultasi Baru
        </Button>
      </div>

      {active && !open && (
        <p className="mt-2 text-xs text-muted-foreground">
          Aktif: <span className="font-medium text-foreground">{active.initialComplaint?.slice(0, 50)}</span>
          {active.doctorName && ` · ${active.doctorName}`}
        </p>
      )}

      {open && (
        <ul className="chat-scrollbar mt-3 max-h-52 space-y-2 overflow-y-auto">
          {items.length === 0 && (
            <li className="py-4 text-center text-xs text-muted-foreground">
              Belum ada konsultasi. Mulai dengan menulis keluhan Anda.
            </li>
          )}
          {items.map((item) => (
            <li key={item.sessionId}>
              <button
                type="button"
                onClick={() => onSelect(item.sessionId)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary/30 ${
                  activeSessionId === item.sessionId
                    ? "border-primary bg-background shadow-sm"
                    : "border-border/60 bg-background/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium line-clamp-1">
                    {item.initialComplaint ?? `Konsultasi #${item.sessionId}`}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      (item.uiPhase && PHASE_COLOR[item.uiPhase]) ?? "bg-primary/10 text-primary"
                    }`}
                  >
                    {(item.uiPhase && PHASE_LABEL[item.uiPhase]) ?? item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.doctorName ? `${item.doctorName} · ` : ""}
                  {formatDate(item.updatedAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
