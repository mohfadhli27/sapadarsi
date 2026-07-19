"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { useAuthStoresHydrated } from "@/src/hooks/use-auth-hydrated";
import { getDashboardPathForRole } from "@/src/lib/staff-portal-config";
import { LoadingSpinner } from "@/src/components/shared/loading-spinner";
import type { StaffRole } from "@/src/types/staff";

export function StaffRoleGuard({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole: StaffRole;
}) {
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

    if (staff.role !== allowedRole) {
      router.replace(getDashboardPathForRole(staff.role));
    }
  }, [hydrated, isAuthenticated, staff, allowedRole, router]);

  const allowed =
    hydrated && isAuthenticated && staff && staff.role === allowedRole;

  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingSpinner size="lg" text="Memuat portal tenaga medis..." />
      </div>
    );
  }

  return <>{children}</>;
}
