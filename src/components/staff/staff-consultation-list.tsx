"use client";

import Link from "next/link";
import type { ConsultationListItem } from "@/src/lib/doctor-consultation-service";

const PHASE_LABEL: Record<string, string> = {
  triage: "Triase",
  selecting_doctor: "Pilih dokter",
  waiting: "Menunggu",
  live: "Live",
  closed: "Selesai",
  rejected: "Ditolak",
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
  consultations: ConsultationListItem[];
};

export function StaffConsultationList({ consultations }: Props) {
  if (consultations.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
        Belum ada konsultasi
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {consultations.map((c) => (
        <li key={c.sessionId}>
          <Link
            href={`/staff/consultations/${c.sessionId}`}
            className="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {c.patientName ?? "Pasien"} ({c.patientRm ?? "-"})
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {c.initialComplaint ?? "-"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.doctorName ? `${c.doctorName} · ` : ""}
                  {c.unitName ?? ""} · {formatDate(c.updatedAt)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {(c.uiPhase && PHASE_LABEL[c.uiPhase]) ?? c.status}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
