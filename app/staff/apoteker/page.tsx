import { Suspense } from "react";
import { PharmacyStaffGuard } from "@/src/components/staff/pharmacy-staff-guard";
import { PharmacyPortalDashboard } from "@/src/components/staff/pharmacy-portal-dashboard";

export default function StaffPharmacistPortalPage() {
  return (
    <PharmacyStaffGuard>
      <Suspense fallback={null}>
        <PharmacyPortalDashboard />
      </Suspense>
    </PharmacyStaffGuard>
  );
}
