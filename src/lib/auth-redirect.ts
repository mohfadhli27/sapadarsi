import { ROUTES } from "@/src/config/routes";
import { isSapabidan } from "@/src/config/app-variant";
import { getDashboardPathForRole } from "@/src/lib/staff-portal-config";
import type { StaffRole } from "@/src/types/staff";

export function getPatientHomePath() {
  return isSapabidan ? ROUTES.chat("bidan") : ROUTES.home;
}

export function getPostLoginPathForStaff(role: StaffRole) {
  return getDashboardPathForRole(role);
}

export type LoginDestination =
  | { accountType: "patient"; path: string }
  | { accountType: "staff"; path: string; role: StaffRole };

export function resolveLoginDestination(input: {
  accountType: "patient" | "staff";
  role?: StaffRole;
}): LoginDestination {
  if (input.accountType === "patient") {
    return { accountType: "patient", path: getPatientHomePath() };
  }
  const role = input.role ?? "doctor";
  return { accountType: "staff", path: getPostLoginPathForStaff(role), role };
}
