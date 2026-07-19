import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/src/lib/staff-api-auth";

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ success: true, staff });
}
