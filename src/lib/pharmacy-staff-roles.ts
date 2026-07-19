import { isAdminRole } from "@/src/lib/admin-roles";

export function canAccessPharmacyOrders(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === "pharmacist" || isAdminRole(role);
}
