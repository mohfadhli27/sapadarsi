"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Clock, MessageCircle } from "lucide-react";
import { DarsiMark } from "@/src/components/shared/darsi-mark";
import { Logo } from "@/src/components/shared/logo";
import { SapabidanLogos } from "@/src/components/shared/sapabidan-logos";
import { SapabidanFooter } from "@/src/components/shared/sapabidan-footer";
import { MobileMenu } from "@/src/components/shared/mobile-menu";
import { HomeDesktopNav } from "@/src/components/shared/home-desktop-nav";
import { ThemeToggle } from "@/src/components/layout/theme-toggle";
import { UserNavButton } from "@/src/components/shared/user-nav-button";
import { StaffPortalNavButton } from "@/src/components/staff/staff-portal-nav-button";
import { AuthModal } from "@/src/components/auth/auth-modal";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { useAuthStore } from "@/src/stores/auth-store";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { useAuthHydrated } from "@/src/hooks/use-auth-hydrated";
import { getDashboardPathForRole } from "@/src/lib/staff-portal-config";
import { getPatientHomePath } from "@/src/lib/auth-redirect";
import { HOME_CARE_APPS } from "@/src/config/home-care";
import { getBrand } from "@/src/config/brand";
import { getConsultationServices } from "@/src/config/consultation-services";
import { isSapabidan } from "@/src/config/app-variant";
import { siteConfig } from "@/src/config/site";
import { cn } from "@/src/lib/utils";
import { ScrollbarReveal } from "@/src/components/shared/scrollbar-reveal";
import { SapabidanMark } from "@/src/components/shared/sapabidan-mark";

const BADGES = [
  { icon: ShieldCheck, label: "Analisis AI tervalidasi" },
  { icon: Clock, label: "Tersedia 24 jam" },
  { icon: MessageCircle, label: "Konsultasi real-time" },
];

export function DarsiHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const staffAuthenticated = useStaffAuthStore((s) => s.isAuthenticated);
  const staff = useStaffAuthStore((s) => s.staff);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearAuthParam = useCallback(() => {
    if (!searchParams.get("auth")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/");
  }, [router, searchParams]);

  // ?auth=login — tab baru (sessionStorage kosong) bisa login akun lain.
  // Jangan logout otomatis: guard yang redirect ke sini sebelum hydrate akan menghapus sesi valid.
  // Ganti akun eksplisit: /?auth=login&switch=1
  useEffect(() => {
    if (!hydrated) return;
    if (searchParams.get("auth") !== "login") return;

    if (searchParams.get("switch") === "1") {
      useAuthStore.getState().logout();
      useStaffAuthStore.getState().logout();
      setAuthTab("login");
      setAuthOpen(true);
      return;
    }

    if (staffAuthenticated && staff) {
      router.replace(getDashboardPathForRole(staff.role));
      return;
    }

    if (isAuthenticated) {
      router.replace(getPatientHomePath());
      return;
    }

    setAuthTab("login");
    setAuthOpen(true);
  }, [hydrated, searchParams, isAuthenticated, staffAuthenticated, staff, router]);

  useEffect(() => {
    if (!hydrated) return;
    if (searchParams.get("auth") !== "register") return;

    if (staffAuthenticated && staff) {
      router.replace(getDashboardPathForRole(staff.role));
      return;
    }

    if (isAuthenticated) {
      router.replace(getPatientHomePath());
      return;
    }

    setAuthTab("register");
    setAuthOpen(true);
  }, [hydrated, searchParams, isAuthenticated, staffAuthenticated, staff, router]);

  const openAuth = useCallback((tab: "login" | "register" = "login") => {
    setAuthTab(tab);
    setAuthOpen(true);
  }, []);

  const openService = useCallback(
    (href: string) => {
      if (!hydrated) return;
      if (isAuthenticated) {
        router.push(href);
        return;
      }
      setPendingHref(href);
      openAuth("login");
    },
    [hydrated, isAuthenticated, openAuth, router]
  );

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !pendingHref) return;
    router.push(pendingHref);
    setPendingHref(null);
    setAuthOpen(false);
    clearAuthParam();
  }, [hydrated, isAuthenticated, pendingHref, router, clearAuthParam]);

  const firstName = user?.name?.split(" ")[0] ?? "Pasien";
  const brand = getBrand();
  const consultationServices = getConsultationServices();

  const authHeaderButtons = staffAuthenticated ? (
    <StaffPortalNavButton compact />
  ) : !isAuthenticated ? (
    <>
      <Button
        variant="default"
        size="sm"
        className="h-8 rounded-full px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
        onClick={() => openAuth("login")}
      >
        Masuk
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-full border-emerald-500/30 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
        onClick={() => openAuth("register")}
      >
        Daftar
      </Button>
    </>
  ) : (
    <UserNavButton compact />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-emerald-50/40 dark:bg-background">
      <ScrollbarReveal />
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-md">
        {isSapabidan ? (
          <>
            <div className="mx-auto grid min-h-[3.75rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-2 py-1.5 sm:min-h-[4.25rem] sm:gap-2 sm:px-4 lg:hidden">
              <div className="flex shrink-0 items-center justify-start">
                <MobileMenu onLoginClick={() => openAuth("login")} />
              </div>
              <div className="flex min-w-0 justify-center overflow-hidden px-0.5">
                <SapabidanLogos size="sm" className="justify-center" />
              </div>
              <div className="flex shrink-0 items-center justify-end gap-1">
                <ThemeToggle />
                {!staffAuthenticated && !isAuthenticated ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 shrink-0 rounded-full px-3 text-xs font-semibold sm:hidden"
                    onClick={() => openAuth("login")}
                  >
                    Masuk
                  </Button>
                ) : null}
                <div className="hidden items-center gap-1 sm:flex sm:gap-1.5">
                  {authHeaderButtons}
                </div>
                {(staffAuthenticated || isAuthenticated) && (
                  <div className="flex items-center sm:hidden">{authHeaderButtons}</div>
                )}
              </div>
            </div>
            <div className="hidden min-h-[4.5rem] w-full items-center gap-4 px-6 py-1 xl:px-10 lg:flex">
              <SapabidanLogos size="md" className="shrink-0 justify-start" />
              <div className="flex flex-1 justify-center">
                <HomeDesktopNav onServiceClick={openService} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
                {authHeaderButtons}
              </div>
            </div>
          </>
        ) : (
          <>
        {/* Mobile & tablet */}
        <div className="mx-auto grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:h-16 sm:px-6 lg:hidden">
          <div className="flex items-center justify-start">
            <MobileMenu onLoginClick={() => openAuth("login")} />
          </div>
          <div className="flex min-w-0 justify-center overflow-hidden px-0.5">
            <Logo size="sm" className="origin-center scale-[0.88] justify-center sm:scale-100" />
          </div>
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <ThemeToggle />
            {authHeaderButtons}
          </div>
        </div>

        {/* Desktop — logo kiri, tab tengah, aksi kanan */}
        <div className="hidden h-16 w-full items-center gap-6 px-8 xl:px-12 lg:flex">
          <Logo size="sm" className="shrink-0" />
          <div className="flex flex-1 justify-center">
            <HomeDesktopNav onServiceClick={openService} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {authHeaderButtons}
          </div>
        </div>
          </>
        )}
      </header>

      <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8 xl:px-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center space-y-8 sm:space-y-10 lg:max-w-none lg:items-stretch">
          <section className="flex w-full flex-col items-center text-center lg:items-start lg:text-left">
            {isSapabidan ? (
              <SapabidanMark size={80} className="mb-5 justify-center lg:justify-start" />
            ) : (
              <DarsiMark size={64} className="mb-5" />
            )}
            <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              {isSapabidan ? (
                <span className="text-emerald-700 dark:text-emerald-400">{brand.heroTitle}</span>
              ) : (
                <>
                  Asisten Kesehatan{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">Digital</span>
                </>
              )}
            </h1>
            <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 sm:text-base">
              {isSapabidan ? brand.heroSubtitle : siteConfig.fullName}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {brand.heroDescription}
            </p>
            {isAuthenticated && user && (
              <p className="mt-5 text-base sm:text-lg">
                <span className="font-semibold text-foreground">Halo. </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{firstName}</span>
              </p>
            )}
          </section>

          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 lg:justify-start">
            {BADGES.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/35 bg-transparent px-3 py-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs dark:border-emerald-400/35"
              >
                <badge.icon className="h-3.5 w-3.5 stroke-[1.75] text-emerald-600 dark:text-emerald-400" />
                {badge.label}
              </span>
            ))}
          </div>

          <section className="w-full">
            <h2 className="mb-5 text-center text-base font-bold text-foreground sm:text-lg lg:text-left">
              Layanan Konsultasi
            </h2>
            <div
              className={cn(
                "grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6",
                consultationServices.length > 1 && "sm:grid-cols-3"
              )}
            >
              {consultationServices.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => openService(svc.href)}
                  className="group flex flex-col items-center rounded-2xl border border-border/50 bg-card p-5 text-center shadow-sm transition-all hover:border-emerald-500/25 hover:shadow-md active:scale-[0.99] sm:p-6"
                >
                  <div
                    className={cn(
                      "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm transition-transform group-hover:scale-105",
                      svc.iconBg
                    )}
                  >
                    <svc.icon className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-bold text-foreground sm:text-base">{svc.label}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {svc.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {brand.showHomeCare && (
          <section className="w-full">
            <div className="mb-5 flex items-center gap-4">
              <h2 className="w-full shrink-0 text-center text-base font-bold text-foreground sm:text-lg lg:w-auto lg:text-left">
                Home Care
              </h2>
              <div className="hidden h-px flex-1 bg-border/40 lg:block" />
            </div>
            <div className="flex flex-wrap items-start justify-center gap-10 rounded-2xl border border-border/40 bg-background/80 px-6 py-6 sm:gap-14 sm:px-10 sm:py-8 lg:justify-start lg:px-8">
              {HOME_CARE_APPS.map((app) => (
                <div key={app.id} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full shadow-sm sm:h-14 sm:w-14",
                        app.iconBg
                      )}
                    >
                      <app.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <Badge
                      variant="secondary"
                      className="absolute -right-5 -top-2 whitespace-nowrap px-1.5 py-0 text-[8px] font-medium sm:text-[9px]"
                    >
                      Coming Soon
                    </Badge>
                  </div>
                  <span className="text-xs font-medium text-foreground sm:text-sm">{app.name}</span>
                </div>
              ))}
            </div>
          </section>
          )}

          <p className="w-full rounded-xl border border-orange-200/70 bg-orange-50/80 px-4 py-3 text-center text-xs leading-relaxed text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-200 sm:text-sm">
            Penting: {brand.disclaimerBrand} memberikan analisis awal berbasis AI dan{" "}
            <strong>bukan diagnosis medis</strong>. Konsultasikan tenaga medis untuk penanganan
            lanjut.
          </p>
        </div>
      </main>

      <footer className="mt-auto border-t border-border/40 bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12">
        {isSapabidan ? (
          <SapabidanFooter />
        ) : (
        <div className="flex w-full flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Logo size="sm" className="lg:justify-start" />
          <p className="text-center text-[11px] text-muted-foreground sm:text-xs lg:text-right">
            &copy; {new Date().getFullYear()} {siteConfig.orgName} &mdash; {siteConfig.fullName}
          </p>
        </div>
        )}
      </footer>

      <AuthModal
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) {
            setPendingHref(null);
            clearAuthParam();
          }
        }}
        defaultTab={authTab}
      />
    </div>
  );
}
