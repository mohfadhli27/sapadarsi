"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  MessageCircle,
  UserRound,
} from "lucide-react";
import type { ConsultationListItem } from "@/src/lib/doctor-consultation-service";
import {
  CONSULTATION_PHASE_LABEL,
  SESSION_STATUS_LABEL,
  formatConsultationDate,
  getPhaseBadgeClass,
} from "@/src/lib/consultation-labels";
import { cn } from "@/src/lib/utils";

type PatientGroup = {
  key: string;
  patientId: number;
  patientName: string;
  patientRm: string;
  sessions: ConsultationListItem[];
  waiting: number;
  active: number;
};

function groupByPatient(items: ConsultationListItem[]): PatientGroup[] {
  const map = new Map<string, PatientGroup>();

  for (const item of items) {
    const key = item.patientRm ?? `pid-${item.patientId}`;
    const existing = map.get(key);
    const isWaiting = item.uiPhase === "waiting" || item.status === "waiting_approval";
    const isActive = item.uiPhase === "live" || item.status === "active";

    if (existing) {
      existing.sessions.push(item);
      if (isWaiting) existing.waiting += 1;
      if (isActive) existing.active += 1;
    } else {
      map.set(key, {
        key,
        patientId: item.patientId,
        patientName: item.patientName ?? "Pasien",
        patientRm: item.patientRm ?? "-",
        sessions: [item],
        waiting: isWaiting ? 1 : 0,
        active: isActive ? 1 : 0,
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
      if (a.waiting !== b.waiting) return b.waiting - a.waiting;
      if (a.active !== b.active) return b.active - a.active;
      const aTime = a.sessions[0]?.updatedAt ?? "";
      const bTime = b.sessions[0]?.updatedAt ?? "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
}

function SessionRow({ item }: { item: ConsultationListItem }) {
  const phaseLabel =
    SESSION_STATUS_LABEL[item.status] ??
    (item.uiPhase ? CONSULTATION_PHASE_LABEL[item.uiPhase] : undefined) ??
    item.status;

  return (
    <Link
      href={`/staff/consultations/${item.sessionId}`}
      className="flex items-start gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 transition-colors hover:border-primary/30 hover:bg-muted/30"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MessageCircle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Sesi #{item.sessionId}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              getPhaseBadgeClass(item.uiPhase ?? item.status, item.status)
            )}
          >
            {phaseLabel}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {item.initialComplaint ?? "Tanpa keluhan awal"}
        </p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {item.unitName ?? "Poli"} · {formatConsultationDate(item.updatedAt)}
        </p>
      </div>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function PatientCard({ group, defaultOpen }: { group: PatientGroup; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? (group.waiting > 0 || group.active > 0));

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/20"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{group.patientName}</p>
          <p className="text-xs text-muted-foreground">No. RM {group.patientRm}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              {group.sessions.length} sesi
            </span>
            {group.waiting > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {group.waiting} menunggu
              </span>
            )}
            {group.active > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                {group.active} aktif
              </span>
            )}
          </div>
        </div>
        {open ? (
          <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-2 border-t bg-muted/10 px-3 py-3">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Sesi konsultasi
          </p>
          {group.sessions.map((session) => (
            <SessionRow key={session.sessionId} item={session} />
          ))}
        </div>
      )}
    </article>
  );
}

export function StaffPatientMonitorBoard({
  consultations,
}: {
  consultations: ConsultationListItem[];
}) {
  const patients = useMemo(() => groupByPatient(consultations), [consultations]);
  const needsAttention = patients.filter((p) => p.waiting > 0 || p.active > 0);

  if (consultations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-16 text-center">
        <UserRound className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <p className="mt-3 text-sm font-medium">Belum ada pasien</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Konsultasi yang ditugaskan ke Anda akan dikelompokkan per pasien
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {needsAttention.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
            <Clock className="h-4 w-4" />
            Perlu perhatian ({needsAttention.length} pasien)
          </h2>
          <div className="space-y-3">
            {needsAttention.map((group) => (
              <PatientCard key={group.key} group={group} defaultOpen />
            ))}
          </div>
        </section>
      )}

      {patients.length > needsAttention.length && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">
            Semua pasien ({patients.length})
          </h2>
          <div className="space-y-3">
            {patients
              .filter((p) => !needsAttention.some((n) => n.key === p.key))
              .map((group) => (
                <PatientCard key={group.key} group={group} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
