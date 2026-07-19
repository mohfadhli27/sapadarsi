import { StaffGuard } from "@/src/components/staff/staff-guard";

export default function StaffPortalLayout({ children }: { children: React.ReactNode }) {
  return <StaffGuard>{children}</StaffGuard>;
}
