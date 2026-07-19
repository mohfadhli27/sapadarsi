"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Stethoscope } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { parseDoctorDisplayName } from "@/src/lib/doctor-display";
import type { PatientDoctorSession } from "@/src/lib/doctor-consultation-service";
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

function sessionTitle(session: PatientDoctorSession) {
  const complaint =
    session.initialComplaint?.trim() ||
    session.lastPreview?.trim() ||
    "Konsultasi dokter";
  return complaint.length > 48 ? `${complaint.slice(0, 48)}…` : complaint;
}

function sessionSubtitle(session: PatientDoctorSession) {
  if (session.doctorName) {
    const parsed = parseDoctorDisplayName(session.doctorName);
    const name = `${parsed.prefix ? `${parsed.prefix} ` : ""}${parsed.personName}`;
    return parsed.gelar || session.unitName ? `${name}${parsed.gelar ? ` · ${parsed.gelar}` : ""}` : name;
  }
  if (session.status === "waiting_approval") return "Menunggu persetujuan dokter";
  if (session.uiPhase === "selecting_doctor") return "Pilih dokter";
  return "Belum memilih dokter";
}

function isSessionActive(session: PatientDoctorSession) {
  return (
    session.status === "triage" ||
    session.status === "waiting_approval" ||
    session.status === "active" ||
    ["waiting", "live", "selecting_doctor", "triage"].includes(session.uiPhase)
  );
}

type Props = {
  patientId: number | undefined;
  selectedSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  onNewConsultation: () => void;
  loadSessions: () => Promise<PatientDoctorSession[]>;
  onClose?: () => void;
  inDrawer?: boolean;
};

export function PatientDoctorSidebar({
  patientId,
  selectedSessionId,
  onSelectSession,
  onNewConsultation,
  loadSessions,
  onClose,
  inDrawer = false,
}: Props) {
  const [sessions, setSessions] = useState<PatientDoctorSession[]>([]);
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
        (s.doctorName ?? "").toLowerCase().includes(q) ||
        (s.initialComplaint ?? "").toLowerCase().includes(q) ||
        (s.unitName ?? "").toLowerCase().includes(q)
    );
  }, [sessions, query]);

  function handleSelect(sessionId: number) {
    onSelectSession(sessionId);
    onClose?.();
  }

  function handleNew() {
    onNewConsultation();
    onClose?.();
  }

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
          onClick={handleNew}
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
            {query ? "Konsultasi tidak ditemukan" : "Belum ada riwayat konsultasi"}
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
                  onClick={() => handleSelect(session.sessionId)}
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
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      <Stethoscope className="h-4 w-4" />
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
