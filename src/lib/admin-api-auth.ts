import { NextRequest } from "next/server";
import { requireStaff } from "@/src/lib/staff-api-auth";
import { isAdminRole } from "@/src/lib/admin-roles";
import type { StaffUser } from "@/src/types/staff";

export { ADMIN_ROLES, isAdminRole } from "@/src/lib/admin-roles";

export async function requireAdmin(req: NextRequest): Promise<StaffUser | null> {
  const staff = await requireStaff(req);
  if (!staff || !isAdminRole(staff.role)) return null;
  return staff;
}
