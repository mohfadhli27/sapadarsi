"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { useAuthStoresHydrated } from "@/src/hooks/use-auth-hydrated";
import { canAccessPharmacyOrders } from "@/src/lib/pharmacy-staff-roles";
import { getDashboardPathForRole } from "@/src/lib/staff-portal-config";
import { LoadingSpinner } from "@/src/components/shared/loading-spinner";

export function PharmacyStaffGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStoresHydrated();
  const staff = useStaffAuthStore((s) => s.staff);
  const isAuthenticated = useStaffAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated || !staff) {
      router.replace("/?auth=login");
      return;
    }

    if (!canAccessPharmacyOrders(staff.role)) {
      router.replace(getDashboardPathForRole(staff.role));
    }
  }, [hydrated, isAuthenticated, staff, router]);

  const allowed =
    hydrated &&
    isAuthenticated &&
    staff &&
    canAccessPharmacyOrders(staff.role);

  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingSpinner size="lg" text="Memuat portal apoteker..." />
      </div>
    );
  }

  return <>{children}</>;
}
