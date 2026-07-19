export const CONSULTATION_PHASE_LABEL: Record<string, string> = {
  triage: "Triase",
  selecting_doctor: "Pilih dokter",
  selecting_practitioner: "Pilih bidan/perawat",
  waiting: "Menunggu dokter",
  live: "Berlangsung",
  closed: "Selesai",
  rejected: "Ditolak",
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  waiting_approval: "Menunggu persetujuan",
  active: "Sedang berjalan",
  closed: "Selesai",
  rejected: "Ditolak",
};

export function formatConsultationDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function getPhaseBadgeClass(phase: string, status?: string) {
  if (phase === "waiting" || status === "waiting_approval") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  }
  if (phase === "live" || status === "active") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (phase === "closed" || status === "closed") {
    return "bg-muted text-muted-foreground";
  }
  if (phase === "rejected" || status === "rejected") {
    return "bg-destructive/10 text-destructive";
  }
  return "bg-primary/10 text-primary";
}
