"use client";

import { useMemo, useState } from "react";
import type { ConsultationListItem } from "@/src/lib/doctor-consultation-service";
import {
  CONSULTATION_PHASE_LABEL,
  SESSION_STATUS_LABEL,
  formatConsultationDate,
  getPhaseBadgeClass,
} from "@/src/lib/consultation-labels";
import { cn } from "@/src/lib/utils";
import { Search } from "lucide-react";

export type PatientSessionGroup = {
  key: string;
  patientId: number;
  patientName: string;
  patientRm: string;
  sessions: ConsultationListItem[];
};

export function groupConsultationsByPatient(
  items: ConsultationListItem[]
): PatientSessionGroup[] {
  const map = new Map<string, PatientSessionGroup>();

  for (const item of items) {
    const key = String(item.patientId);
    const existing = map.get(key);
    if (existing) {
      existing.sessions.push(item);
    } else {
      map.set(key, {
        key,
        patientId: item.patientId,
        patientName: item.patientName ?? "Pasien",
        patientRm: item.patientRm ?? "-",
        sessions: [item],
      });
    }
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      sessions: [...g.sessions].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    }))
    .sort((a, b) => {
      const score = (g: PatientSessionGroup) => {
        const hasWaiting = g.sessions.some(
          (s) => s.uiPhase === "waiting" || s.status === "waiting_approval"
        );
        const hasActive = g.sessions.some(
          (s) => s.uiPhase === "live" || s.status === "active"
        );
        return (hasWaiting ? 100 : 0) + (hasActive ? 50 : 0);
      };
      if (score(a) !== score(b)) return score(b) - score(a);
      const aTime = a.sessions[0]?.updatedAt ?? "";
      const bTime = b.sessions[0]?.updatedAt ?? "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
}

type Props = {
  consultations: ConsultationListItem[];
  selectedSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  loading?: boolean;
};

export function StaffSessionSidebar({
  consultations,
  selectedSessionId,
  onSelectSession,
  loading,
}: Props) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupConsultationsByPatient(consultations), [consultations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        sessions: g.sessions.filter(
          (s) =>
            g.patientName.toLowerCase().includes(q) ||
            g.patientRm.toLowerCase().includes(q) ||
            String(s.sessionId).includes(q) ||
            (s.initialComplaint ?? "").toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.sessions.length > 0);
  }, [groups, query]);

  return (
    <aside className="flex h-full flex-col border-r bg-muted/20">
      <div className="border-b p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pasien & sesi
        </p>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pasien atau keluhan..."
            className="h-9 w-full rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
      </div>

      <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {loading && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">Memuat...</p>
        )}

        {!loading && filtered.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {query ? "Tidak ditemukan" : "Belum ada konsultasi"}
          </p>
        )}

        {!loading &&
          filtered.map((group) => (
            <div key={group.key} className="mb-4">
              <div className="sticky top-0 z-[1] bg-muted/20 px-2 py-1.5 backdrop-blur-sm">
                <p className="truncate text-xs font-bold text-foreground">{group.patientName}</p>
                <p className="text-[10px] text-muted-foreground">RM {group.patientRm}</p>
              </div>

              <ul className="mt-1 space-y-0.5">
                {group.sessions.map((session) => {
                  const label =
                    SESSION_STATUS_LABEL[session.status] ??
                    (session.uiPhase ? CONSULTATION_PHASE_LABEL[session.uiPhase] : undefined) ??
                    session.status;
                  const selected = selectedSessionId === session.sessionId;
                  const urgent =
                    session.uiPhase === "waiting" ||
                    session.status === "waiting_approval" ||
                    session.status === "active" ||
                    session.uiPhase === "live";

                  return (
                    <li key={session.sessionId}>
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.sessionId)}
                        className={cn(
                          "w-full rounded-lg px-2.5 py-2.5 text-left transition-colors",
                          selected
                            ? "bg-primary/10 ring-1 ring-primary/25"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Sesi #{session.sessionId}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold",
                              getPhaseBadgeClass(session.uiPhase ?? session.status, session.status)
                            )}
                          >
                            {label}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "mt-1 line-clamp-2 text-xs leading-snug",
                            urgent && !selected ? "font-medium text-foreground" : "text-foreground/90"
                          )}
                        >
                          {session.initialComplaint ?? "Tanpa keluhan"}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {formatConsultationDate(session.updatedAt)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </div>
    </aside>
  );
}
