"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Baby, Plus, Search } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { parseDoctorDisplayName } from "@/src/lib/doctor-display";
import type { PatientMidwifeSession } from "@/src/lib/consultation-service";
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

function sessionTitle(session: PatientMidwifeSession) {
  const complaint =
    session.initialComplaint?.trim() ||
    session.lastPreview?.trim() ||
    "Konsultasi bidan";
  return complaint.length > 48 ? `${complaint.slice(0, 48)}…` : complaint;
}

function sessionSubtitle(session: PatientMidwifeSession) {
  if (session.practitionerName) {
    const parsed = parseDoctorDisplayName(session.practitionerName);
    return `${parsed.prefix ? `${parsed.prefix} ` : ""}${parsed.personName}`;
  }
  if (session.status === "waiting_approval") return "Menunggu persetujuan";
  if (session.uiPhase === "selecting_practitioner") return "Pilih bidan/perawat";
  return "Belum memilih bidan/perawat";
}

function isSessionActive(session: PatientMidwifeSession) {
  return (
    session.status === "triage" ||
    session.status === "waiting_approval" ||
    session.status === "active" ||
    ["waiting", "live", "selecting_practitioner", "triage"].includes(session.uiPhase)
  );
}

type Props = {
  patientId: number | undefined;
  selectedSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  onNewConsultation: () => void;
  loadSessions: () => Promise<PatientMidwifeSession[]>;
  inDrawer?: boolean;
  onClose?: () => void;
};

export function PatientMidwifeSidebar({
  patientId,
  selectedSessionId,
  onSelectSession,
  onNewConsultation,
  loadSessions,
  inDrawer = false,
  onClose,
}: Props) {
  const [sessions, setSessions] = useState<PatientMidwifeSession[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      setSessions(await loadSessions());
    } finally {
      setLoading(false);
    }
  }, [patientId, loadSessions]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        sessionTitle(s).toLowerCase().includes(q) ||
        (s.lastPreview ?? "").toLowerCase().includes(q) ||
        (s.practitionerName ?? "").toLowerCase().includes(q) ||
        (s.initialComplaint ?? "").toLowerCase().includes(q)
    );
  }, [sessions, query]);

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col",
        inDrawer
          ? "bg-background"
          : "border-r bg-muted/15 md:w-72 md:shrink-0 lg:w-80"
      )}
    >
      <div className={cn("border-b p-3", inDrawer && "border-border/60 bg-background")}>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start gap-2 rounded-xl",
            inDrawer ? "border-border bg-muted/40" : "border-dashed"
          )}
          onClick={() => {
            onNewConsultation();
            onClose?.();
          }}
        >
          <Plus className="h-4 w-4" />
          Konsultasi baru
        </Button>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari konsultasi..."
            className="h-9 w-full rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
      </div>

      <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {loading && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">Memuat riwayat...</p>
        )}

        {!loading && filtered.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {query ? "Konsultasi tidak ditemukan" : "Belum ada riwayat konsultasi bidan"}
          </p>
        )}

        <ul className="space-y-0.5">
          {filtered.map((session) => {
            const selected = selectedSessionId === session.sessionId;
            const active = isSessionActive(session);

            return (
              <li key={session.sessionId}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(session.sessionId);
                    onClose?.();
                  }}
                  className={cn(
                    "w-full rounded-xl px-3 py-3 text-left transition-colors",
                    selected
                      ? "bg-primary/10 ring-1 ring-primary/25"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        selected ? "bg-primary text-primary-foreground" : "bg-pink-500/10 text-pink-700"
                      )}
                    >
                      <Baby className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{sessionTitle(session)}</p>
                        {active && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <p className="truncate text-[11px] text-primary/80">{sessionSubtitle(session)}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {session.lastPreview ?? "Belum ada pesan"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Sesi #{session.sessionId} · {formatRelative(session.updatedAt)}
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
