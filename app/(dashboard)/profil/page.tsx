"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, FileText, LogOut, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/src/stores/auth-store";
import { useAuth } from "@/src/hooks/use-auth";
import { ThemeToggle } from "@/src/components/layout/theme-toggle";
import { MobileMenu } from "@/src/components/shared/mobile-menu";
import { Button } from "@/src/components/ui/button";
import { Separator } from "@/src/components/ui/separator";
import { getConsultationServices } from "@/src/config/consultation-services";
import { isSapabidan } from "@/src/config/app-variant";
import { cn } from "@/src/lib/utils";

export default function ProfilPage() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const router = useRouter();
  const consultationServices = getConsultationServices();

  const fields = [
    { label: "Nama Lengkap", value: user?.name, icon: User },
    { label: "No. Rekam Medis", value: user?.medicalRecordNumber, icon: FileText },
    { label: "Email", value: user?.email, icon: FileText },
    { label: "Username", value: user?.username, icon: FileText },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50/40 to-background dark:from-background">
      <nav className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4 sm:max-w-2xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Kembali ke beranda"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold text-foreground">Profil Saya</h1>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileMenu onLoginClick={() => router.push("/?auth=login")} />
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:max-w-2xl sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-md dark:border-emerald-800">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold backdrop-blur-sm">
              {user?.name?.charAt(0)?.toUpperCase() || "P"}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">{user?.name || "Pengguna"}</h2>
              <p className="text-xs text-emerald-100/90">
                {isSapabidan ? "Pasien Sapabidan" : "Pasien RSI Surabaya A. Yani"}
              </p>
              {user?.medicalRecordNumber && (
                <p className="mt-1 text-[11px] font-medium text-emerald-50/80">
                  No. RM {user.medicalRecordNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        <section className="mt-6">
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Layanan Konsultasi
          </h3>
          <div className="space-y-2">
            {consultationServices.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => router.push(svc.href)}
                className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left shadow-sm transition-all hover:border-emerald-500/25 hover:shadow-md"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white",
                    svc.iconBg
                  )}
                >
                  <svc.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{svc.label}</p>
                  <p className="text-[11px] text-muted-foreground">{svc.subtitle}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Informasi Akun
          </h3>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {fields.map((field, i) => (
              <div key={field.label}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <field.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {field.label}
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {field.value || "-"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Informasi
          </h3>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <Link
              href="/kebijakan-privasi"
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">Kebijakan privasi</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </Link>
            <Separator />
            <Link
              href="/syarat-ketentuan"
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">Syarat & ketentuan</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </Link>
          </div>
        </section>

        <Button variant="destructive" onClick={logout} className="mt-6 h-11 w-full rounded-xl">
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </div>
  );
}
