import type { NextRequest } from "next/server";
import { requireStaff } from "@/src/lib/staff-api-auth";
import { canAccessPharmacyOrders } from "@/src/lib/pharmacy-staff-roles";
import type { StaffUser } from "@/src/types/staff";

export { canAccessPharmacyOrders } from "@/src/lib/pharmacy-staff-roles";

export async function requirePharmacyStaff(req: NextRequest): Promise<StaffUser | null> {
  const staff = await requireStaff(req);
  if (!staff || !canAccessPharmacyOrders(staff.role)) return null;
  return staff;
}
