import { NextRequest, NextResponse } from "next/server";
import { revokeStaffSession } from "@/src/lib/staff-auth";
import { getStaffTokenFromRequest } from "@/src/lib/staff-api-auth";

export async function POST(req: NextRequest) {
  const token = getStaffTokenFromRequest(req);
  if (token) {
    await revokeStaffSession(token);
  }
  return NextResponse.json({ success: true });
}
