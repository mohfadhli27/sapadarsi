"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Home,
  LogOut,
  RefreshCw,
  Shield,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Logo } from "@/src/components/shared/logo";
import { useStaffAuth, useStaffFetch } from "@/src/hooks/use-staff-auth";
import { cn } from "@/src/lib/utils";

type Tab = "overview" | "doctors" | "staff" | "sessions" | "sync";

function formatDt(iso: string | null | undefined) {
  if (!iso) return "—";
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

export function AdminDashboard() {
  const { staff, logout } = useStaffAuth();
  const staffFetch = useStaffFetch();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [doctors, setDoctors] = useState<Array<Record<string, unknown>>>([]);
  const [staffList, setStaffList] = useState<Array<Record<string, unknown>>>([]);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [syncInfo, setSyncInfo] = useState<Record<string, unknown> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, doc, st, ses, sync] = await Promise.all([
        staffFetch("/api/admin/overview").then((r) => r.json()),
        staffFetch("/api/admin/doctors").then((r) => r.json()),
        staffFetch("/api/admin/staff").then((r) => r.json()),
        staffFetch("/api/admin/sessions").then((r) => r.json()),
        staffFetch("/api/admin/sync/doctors").then((r) => r.json()),
      ]);
      if (ov.success) setOverview(ov.overview);
      if (doc.success) setDoctors(doc.doctors ?? []);
      if (st.success) setStaffList(st.staff ?? []);
      if (ses.success) setSessions(ses.sessions ?? []);
      if (sync.success) setSyncInfo(sync);
    } finally {
      setLoading(false);
    }
  }, [staffFetch]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function runSync() {
    setSyncing(true);
    setMessage("");
    try {
      const res = await staffFetch("/api/admin/sync/doctors", { method: "POST" });
      const data = await res.json();
      setMessage(data.message ?? (data.success ? "Sinkronisasi berhasil" : "Gagal"));
      await refresh();
    } catch {
      setMessage("Gagal menjalankan sinkronisasi");
    } finally {
      setSyncing(false);
    }
  }

  async function toggleStaff(id: number, isActive: boolean) {
    await staffFetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive }),
    });
    await refresh();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Ringkasan" },
    { id: "sync", label: "Sinkronisasi" },
    { id: "doctors", label: "Direktori Dokter" },
    { id: "staff", label: "Akun Staff" },
    { id: "sessions", label: "Konsultasi" },
  ];

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Administrasi DARSI</p>
              <p className="truncate text-xs text-muted-foreground">
                {staff?.displayName} · {staff?.role}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" asChild title="Halaman utama">
              <Link href="/">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 p-4">
        {message && (
          <div className="rounded-xl border bg-card px-4 py-3 text-sm">{message}</div>
        )}

        {tab === "overview" && overview && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={Stethoscope}
              label="Dokter aktif (direktori)"
              value={String(overview.activeDoctors ?? 0)}
            />
            <StatCard
              icon={Users}
              label="Akun dokter aktif"
              value={String(overview.activeStaffDoctors ?? 0)}
            />
            <StatCard
              icon={Activity}
              label="Konsultasi hari ini"
              value={String(overview.consultationsToday ?? 0)}
            />
            <StatCard
              icon={Shield}
              label="Menunggu persetujuan"
              value={String(overview.waitingApproval ?? 0)}
            />
            <StatCard
              icon={Activity}
              label="Konsultasi live"
              value={String(overview.activeConsultations ?? 0)}
            />
            <StatCard
              icon={RefreshCw}
              label="Sync terakhir"
              value={
                overview.lastSync
                  ? formatDt((overview.lastSync as { startedAt?: string }).startedAt)
                  : "Belum pernah"
              }
            />
          </div>
        )}

        {tab === "sync" && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Sinkronisasi Otomatis RSI</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Sistem mengambil dokter aktif (kuota &gt; 0) dari API RSI dan membuat/memperbarui
                akun staff otomatis.
              </p>
              <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Auto-sync</dt>
                  <dd className="font-medium">
                    {syncInfo?.autoSyncEnabled ? "Aktif" : "Nonaktif (set RSI_SYNC_AUTO=true)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Interval</dt>
                  <dd className="font-medium">{String(syncInfo?.syncIntervalMinutes ?? 360)} menit</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status terakhir</dt>
                  <dd className="font-medium">
                    {(syncInfo?.latest as { status?: string } | null)?.status ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dokter tersinkron</dt>
                  <dd className="font-medium">
                    {String((syncInfo?.latest as { doctorsSynced?: number } | null)?.doctorsSynced ?? "—")}
                  </dd>
                </div>
              </dl>
              <Button className="mt-4 gap-2" onClick={() => void runSync()} disabled={syncing}>
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {syncing ? "Menyinkronkan..." : "Sinkronkan sekarang"}
              </Button>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="border-b px-4 py-3 text-sm font-semibold">Riwayat sinkronisasi</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Waktu</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Dokter</th>
                      <th className="px-3 py-2">Pemicu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((syncInfo?.logs as Array<Record<string, unknown>>) ?? []).map((log) => (
                      <tr key={String(log.id)} className="border-t">
                        <td className="px-3 py-2">{formatDt(log.startedAt as string)}</td>
                        <td className="px-3 py-2">{String(log.status)}</td>
                        <td className="px-3 py-2">{String(log.doctorsSynced)}</td>
                        <td className="px-3 py-2">{String(log.triggeredBy ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "doctors" && (
          <DataTable
            title={`Direktori dokter (${doctors.length})`}
            headers={["Dokter", "Poli", "Kuota", "Jadwal", "Staff", "Status"]}
            rows={doctors.map((d) => [
              String(d.doctorName),
              String(d.unitName),
              `${d.quotaRemaining ?? "?"}/${d.quotaTotal ?? "?"}`,
              String(d.scheduleLabel ?? "—"),
              String(d.staffUsername ?? "—"),
              d.isActive ? "Aktif" : "Nonaktif",
            ])}
          />
        )}

        {tab === "staff" && (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-4 py-3 text-sm font-semibold">
              Akun staff ({staffList.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">HP</th>
                    <th className="px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={String(s.id)} className="border-t">
                      <td className="px-3 py-2 font-mono">{String(s.username)}</td>
                      <td className="px-3 py-2">{String(s.displayName)}</td>
                      <td className="px-3 py-2">{String(s.role)}</td>
                      <td className="px-3 py-2">{String(s.phone ?? "—")}</td>
                      <td className="px-3 py-2">
                        {s.role === "doctor" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() =>
                              void toggleStaff(Number(s.id), !Boolean(s.isActive))
                            }
                          >
                            {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "sessions" && (
          <DataTable
            title="Konsultasi terbaru"
            headers={["ID", "Tipe", "Pasien", "Dokter/Bidan", "Status", "Diperbarui"]}
            rows={sessions.map((s) => [
              String(s.sessionId),
              s.sessionType === "midwife_consultation" ? "Bidan" : "Dokter",
              String(s.patientName ?? "—"),
              String(s.doctorName ?? "—"),
              String(s.status),
              formatDt(s.updatedAt as string),
            ])}
          />
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          Portal dokter:{" "}
          <Link href="/staff/login" className="text-primary hover:underline">
            /staff/login
          </Link>
        </p>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-4 py-3 text-sm font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
