"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { useAuthStoresHydrated } from "@/src/hooks/use-auth-hydrated";
import { isAdminRole } from "@/src/lib/admin-roles";
import { LoadingSpinner } from "@/src/components/shared/loading-spinner";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStoresHydrated();
  const staff = useStaffAuthStore((s) => s.staff);
  const isAuthenticated = useStaffAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated || !staff || !isAdminRole(staff.role)) {
      router.replace("/?auth=login");
    }
  }, [hydrated, isAuthenticated, staff, router]);

  const allowed =
    hydrated && isAuthenticated && staff && isAdminRole(staff.role);

  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingSpinner size="lg" text="Memverifikasi akses admin..." />
      </div>
    );
  }

  return <>{children}</>;
}
