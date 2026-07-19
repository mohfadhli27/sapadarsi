"use client";

import { useStaffAuth } from "@/src/hooks/use-staff-auth";
import type { ConsultationListItem } from "@/src/lib/doctor-consultation-service";
import Link from "next/link";
import { Clock, MessageCircle, CheckCircle2, Inbox } from "lucide-react";

const PHASE_LABEL: Record<string, string> = {
  waiting: "Menunggu Anda",
  live: "Sedang berjalan",
  selecting_doctor: "Memilih dokter",
  triage: "Triase",
  closed: "Selesai",
  rejected: "Ditolak",
};

function groupConsultations(items: ConsultationListItem[]) {
  const waiting: ConsultationListItem[] = [];
  const active: ConsultationListItem[] = [];
  const done: ConsultationListItem[] = [];

  for (const c of items) {
    if (c.uiPhase === "waiting" || c.status === "waiting_approval") waiting.push(c);
    else if (c.uiPhase === "live" || c.status === "active") active.push(c);
    else done.push(c);
  }
  return { waiting, active, done };
}

function ConsultationCard({ item }: { item: ConsultationListItem }) {
  return (
    <Link
      href={`/staff/consultations/${item.sessionId}`}
      className="block rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
    >
      <p className="font-semibold">{item.patientName ?? "Pasien"}</p>
      <p className="text-xs text-muted-foreground">{item.patientRm}</p>
      <p className="mt-2 line-clamp-2 text-sm">{item.initialComplaint ?? "-"}</p>
      <p className="mt-2 text-xs text-primary">{item.unitName}</p>
    </Link>
  );
}

function Section({
  title,
  icon,
  items,
  empty,
  highlight,
}: {
  title: string;
  icon: React.ReactNode;
  items: ConsultationListItem[];
  empty: string;
  highlight?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2
        className={`flex items-center gap-2 text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {icon}
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <ConsultationCard key={item.sessionId} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export function StaffConsultationBoard({ consultations }: { consultations: ConsultationListItem[] }) {
  const { staff } = useStaffAuth();
  const { waiting, active, done } = groupConsultations(consultations);

  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm">
        <p className="font-medium">Selamat datang, {staff?.displayName}</p>
        <p className="text-xs text-muted-foreground">
          Hanya konsultasi yang ditugaskan kepada Anda yang tampil di sini.
        </p>
      </div>

      <Section
        title="Perlu Konfirmasi Anda"
        icon={<Clock className="h-4 w-4 text-amber-600" />}
        items={waiting}
        empty="Tidak ada permintaan menunggu approval"
        highlight
      />

      <Section
        title="Konsultasi Berlangsung"
        icon={<MessageCircle className="h-4 w-4 text-emerald-600" />}
        items={active}
        empty="Tidak ada konsultasi aktif"
      />

      <Section
        title="Riwayat"
        icon={<CheckCircle2 className="h-4 w-4" />}
        items={done.slice(0, 10)}
        empty="Belum ada riwayat"
      />

      {consultations.length === 0 && (
        <div className="py-12 text-center">
          <Inbox className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada konsultasi untuk Anda</p>
        </div>
      )}
    </div>
  );
}
