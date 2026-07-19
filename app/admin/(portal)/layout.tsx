import { AdminGuard } from "@/src/components/admin/admin-guard";

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
