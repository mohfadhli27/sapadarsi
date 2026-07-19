"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { useAuthStoresHydrated } from "@/src/hooks/use-auth-hydrated";
import { LoadingSpinner } from "@/src/components/shared/loading-spinner";

export function StaffGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStoresHydrated();
  const isAuthenticated = useStaffAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace("/?auth=login");
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingSpinner size="lg" text="Memverifikasi sesi pekerja..." />
      </div>
    );
  }

  return <>{children}</>;
}
