"use client";

import Link from "next/link";
import { Baby, Bell, Home, LogOut, Pill, Stethoscope } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Logo } from "@/src/components/shared/logo";
import { useStaffAuth } from "@/src/hooks/use-staff-auth";
import { getPortalMeta } from "@/src/lib/staff-portal-config";
import { cn } from "@/src/lib/utils";
import type { StaffRole } from "@/src/types/staff";

type StaffPortalShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  unreadCount?: number;
  onRequestNotifications?: () => void;
  className?: string;
};

function RoleIcon({ role }: { role?: StaffRole }) {
  if (role === "nurse") return <Baby className="h-5 w-5 text-primary" />;
  if (role === "pharmacist") return <Pill className="h-5 w-5 text-primary" />;
  return <Stethoscope className="h-5 w-5 text-primary" />;
}

export function StaffPortalShell({
  children,
  title,
  subtitle,
  unreadCount = 0,
  onRequestNotifications,
  className,
}: StaffPortalShellProps) {
  const { staff, logout } = useStaffAuth();
  const portal = getPortalMeta(staff);

  return (
    <div className={cn("min-h-dvh bg-gradient-to-b from-muted/30 to-background", className)}>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 xl:max-w-[1400px]">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{staff?.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {staff?.unitName ?? portal.badge}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" asChild title="Halaman pasien">
              <Link href="/">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            {onRequestNotifications && (
              <Button
                variant="ghost"
                size="icon"
                title="Aktifkan notifikasi browser"
                onClick={onRequestNotifications}
              >
                <Bell className={cn("h-5 w-5", unreadCount > 0 && "text-primary")} />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => void logout()} title="Keluar">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 xl:max-w-[1400px]">
        <div className={cn("mb-6 overflow-hidden rounded-2xl border p-5 shadow-sm bg-gradient-to-br", portal.accentClass)}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/80 shadow-sm">
              <RoleIcon role={staff?.role} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {portal.badge}
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
                {title ?? portal.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {subtitle ?? portal.subtitle}
              </p>
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
