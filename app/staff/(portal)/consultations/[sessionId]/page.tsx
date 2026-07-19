"use client";

import { useParams, useRouter } from "next/navigation";
import { StaffMonitorPanel } from "@/src/components/staff/staff-monitor-panel";
import { StaffPortalShell } from "@/src/components/staff/staff-portal-shell";
import { useStaffAuth } from "@/src/hooks/use-staff-auth";

export default function StaffConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const { staff } = useStaffAuth();
  const sessionId = Number(params.sessionId);

  if (!Number.isFinite(sessionId)) {
    return <p className="p-6 text-destructive">ID sesi tidak valid</p>;
  }

  return (
    <StaffPortalShell
      title="Monitor Sesi"
      subtitle={`Sesi konsultasi #${sessionId}`}
      className="bg-[#f8faf9] dark:bg-background"
    >
      <StaffMonitorPanel
        sessionId={sessionId}
        onBack={() =>
          router.push(
            staff?.role === "nurse" ? "/staff/bidan?tab=pasien" : "/staff/dokter?tab=pasien"
          )
        }
      />
    </StaffPortalShell>
  );
}
