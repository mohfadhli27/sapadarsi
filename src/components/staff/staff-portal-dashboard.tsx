"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BellRing, CheckCircle2, Clock, MessageCircle, Users } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { useStaffAuth, useStaffFetch } from "@/src/hooks/use-staff-auth";
import { useStaffNotifications } from "@/src/hooks/use-staff-notifications";
import { StaffPatientMonitorBoard } from "@/src/components/staff/staff-patient-monitor-board";
import { StaffPortalShell } from "@/src/components/staff/staff-portal-shell";
import { StaffApprovalActions } from "@/src/components/staff/staff-approval-actions";
import { getPortalMeta } from "@/src/lib/staff-portal-config";
import type { ConsultationListItem } from "@/src/lib/doctor-consultation-service";
import type { StaffNotification } from "@/src/types/staff";

function formatTime(iso: string) {
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

type TabId = "notif" | "approval" | "pasien";

export function StaffPortalDashboard() {
  const searchParams = useSearchParams();
  const { staff, authHeaders } = useStaffAuth();
  const staffFetch = useStaffFetch();
  const { fetchNotifications, pollMs, requestBrowserPermission } = useStaffNotifications(5000);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [consultations, setConsultations] = useState<ConsultationListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("notif");
  const [actionSessionId, setActionSessionId] = useState<number | null>(null);

  const portal = getPortalMeta(staff);
  const portalBase = staff?.role === "nurse" ? "/staff/bidan" : "/staff/dokter";

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "pasien" || requested === "approval" || requested === "notif") {
      setTab(requested);
    } else if (requested === "approval" || Number(searchParams.get("pending") ?? 0) > 0) {
      setTab("approval");
    }
  }, [searchParams]);

  const pendingApprovals = useMemo(
    () => consultations.filter((c) => c.status === "waiting_approval"),
    [consultations]
  );

  useEffect(() => {
    if (pendingApprovals.length > 0 && tab === "notif" && !searchParams.get("tab")) {
      setTab("approval");
    }
  }, [pendingApprovals.length, tab, searchParams]);

  const refresh = useCallback(async () => {
    const data = await fetchNotifications();
    if (data) {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
    try {
      const res = await staffFetch("/api/staff/consultations");
      const json = await res.json();
      if (res.ok) setConsultations(json.consultations ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [fetchNotifications, staffFetch]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(interval);
  }, [refresh, pollMs]);

  async function markRead(id: number) {
    await fetch("/api/staff/notifications/" + id + "/read", {
      method: "POST",
      headers: authHeaders(),
    });
    await refresh();
  }

  async function markAllRead() {
    await fetch("/api/staff/notifications", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "read_all" }),
    });
    await refresh();
  }

  async function handleApproval(sessionId: number, action: "approve" | "reject", reason?: string) {
    setActionSessionId(sessionId);
    try {
      const res = await staffFetch(`/api/staff/consultations/${sessionId}`, {
        method: "POST",
        body: JSON.stringify({
          action,
          ...(reason ? { reason } : {}),
          actor: staff?.displayName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Gagal memproses");
      await refresh();
    } finally {
      setActionSessionId(null);
    }
  }

  const patientCount = new Set(consultations.map((c) => c.patientId)).size;

  return (
    <StaffPortalShell
      unreadCount={unreadCount}
      onRequestNotifications={() => void requestBrowserPermission()}
    >
      <div className="mb-4 rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm dark:border-sky-900 dark:bg-sky-950/30">
        <p className="font-medium text-sky-950 dark:text-sky-100">
          Persetujuan 2 jalur: halaman web + Telegram
        </p>
        <p className="mt-1 text-xs leading-relaxed text-sky-900/80 dark:text-sky-200/80">
          Setujui/tolak di tab <strong>Persetujuan</strong> atau di halaman monitor sesi. Alternatif:
          gunakan tombol Setujui/Tolak di grup Telegram approval.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={BellRing}
          label="Notifikasi belum dibaca"
          value={String(unreadCount)}
          highlight={unreadCount > 0}
        />
        <StatCard
          icon={Clock}
          label="Menunggu persetujuan"
          value={String(pendingApprovals.length)}
          highlight={pendingApprovals.length > 0}
        />
        <StatCard icon={Users} label="Pasien aktif" value={String(patientCount)} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto rounded-xl border bg-muted/40 p-1">
          {(
            [
              ["notif", `Notifikasi${unreadCount > 0 ? ` (${unreadCount})` : ""}`, BellRing],
              ["approval", `Persetujuan${pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ""}`, Clock],
              ["pasien", `Monitor pasien (${patientCount})`, MessageCircle],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === id ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && tab === "notif" && (
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            Tandai semua dibaca
          </Button>
        )}
      </div>

      {tab === "approval" &&
        (loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Memuat permintaan...</p>
        ) : pendingApprovals.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">Tidak ada permintaan menunggu</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Permintaan baru muncul di sini, tab Notifikasi, dan Telegram
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingApprovals.map((item) => (
              <article key={item.sessionId} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.patientName ?? "Pasien"}</p>
                    <p className="text-xs text-muted-foreground">
                      RM {item.patientRm ?? "-"} · Sesi #{item.sessionId}
                      {item.sessionType?.includes("midwife") || item.sessionType?.includes("nurse")
                        ? " · Bidan"
                        : " · Dokter"}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {item.initialComplaint ?? "Tanpa keluhan awal"}
                    </p>
                  </div>
                  <Link
                    href={`/staff/consultations/${item.sessionId}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Monitor live →
                  </Link>
                </div>
                <StaffApprovalActions
                  disabled={actionSessionId === item.sessionId}
                  onApprove={() => handleApproval(item.sessionId, "approve")}
                  onReject={(reason) => handleApproval(item.sessionId, "reject", reason)}
                />
              </article>
            ))}
          </div>
        ))}

      {tab === "pasien" &&
        (loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Memuat pasien...</p>
        ) : (
          <StaffPatientMonitorBoard consultations={consultations} />
        ))}

      {tab === "notif" &&
        (loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Memuat notifikasi...</p>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center">
            <BellRing className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">Belum ada notifikasi</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Notifikasi muncul saat pasien memilih {staff?.role === "nurse" ? "bidan" : "dokter"} atau
              mengirim pesan
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.linkPath ?? `/staff/consultations/${n.sessionId}`}
                  onClick={() => {
                    if (!n.readAt) void markRead(n.id);
                  }}
                  className={`block rounded-xl border p-4 transition-colors hover:bg-muted/50 ${
                    !n.readAt ? "border-primary/40 bg-primary/5" : "bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{n.title}</p>
                      {n.body && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">{formatTime(n.createdAt)}</p>
                    </div>
                    {!n.readAt && (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ))}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {portal.title} · {portalBase} · refresh {pollMs / 1000}s
      </p>
    </StaffPortalShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card p-4 shadow-sm ${
        highlight ? "border-primary/30 bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`h-4 w-4 ${highlight ? "text-primary" : ""}`} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
