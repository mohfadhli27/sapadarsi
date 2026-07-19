import { NextRequest } from "next/server";
import { getStaffBySessionToken } from "@/src/lib/staff-auth";
import type { StaffUser } from "@/src/types/staff";

export function getStaffTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  const header = req.headers.get("x-staff-token");
  if (header?.trim()) return header.trim();
  const queryToken = req.nextUrl.searchParams.get("token");
  return queryToken?.trim() || null;
}

export async function requireStaff(req: NextRequest): Promise<StaffUser | null> {
  const token = getStaffTokenFromRequest(req);
  if (!token) return null;
  return getStaffBySessionToken(token);
}
