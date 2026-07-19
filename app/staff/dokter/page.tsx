import { StaffRoleGuard } from "@/src/components/staff/staff-role-guard";
import { StaffPortalDashboard } from "@/src/components/staff/staff-portal-dashboard";

export default function StaffDoctorPortalPage() {
  return (
    <StaffRoleGuard allowedRole="doctor">
      <StaffPortalDashboard />
    </StaffRoleGuard>
  );
}
