"use client";

import { useRouter } from "next/navigation";
import { Stethoscope, Baby, Pill } from "lucide-react";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { getDashboardPathForRole } from "@/src/lib/staff-portal-config";
import { cn } from "@/src/lib/utils";

export function StaffPortalNavButton({ compact }: { compact?: boolean }) {
  const staff = useStaffAuthStore((s) => s.staff);
  const isAuthenticated = useStaffAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  if (!isAuthenticated || !staff) return null;

  const isNurse = staff.role === "nurse";
  const isPharmacist = staff.role === "pharmacist";
  const Icon = isPharmacist ? Pill : isNurse ? Baby : Stethoscope;
  const label = isPharmacist ? "Portal Apotek" : isNurse ? "Portal Bidan" : "Portal Dokter";

  return (
    <button
      type="button"
      onClick={() => router.push(getDashboardPathForRole(staff.role))}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 font-medium text-primary transition-colors hover:bg-primary/10",
        compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className={compact ? "max-w-[88px] truncate" : ""}>{label}</span>
    </button>
  );
}
