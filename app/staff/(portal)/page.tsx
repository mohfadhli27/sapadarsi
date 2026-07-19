"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { useAuthStoresHydrated } from "@/src/hooks/use-auth-hydrated";
import { getDashboardPathForRole } from "@/src/lib/staff-portal-config";
import { LoadingSpinner } from "@/src/components/shared/loading-spinner";

/** /staff → arahkan ke portal sesuai role (dokter atau bidan) */
export default function StaffRootRedirectPage() {
  const hydrated = useAuthStoresHydrated();
  const router = useRouter();
  const staff = useStaffAuthStore((s) => s.staff);
  const isAuthenticated = useStaffAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated || !staff) {
      router.replace("/?auth=login");
      return;
    }
    router.replace(getDashboardPathForRole(staff.role));
  }, [hydrated, isAuthenticated, staff, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LoadingSpinner size="lg" text="Membuka portal staff..." />
    </div>
  );
}
