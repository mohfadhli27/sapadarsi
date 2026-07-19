import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/src/lib/staff-api-auth";
import { markNotificationRead } from "@/src/lib/staff-notification-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const staff = await requireStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  await markNotificationRead(staff.id, Number(id));
  return NextResponse.json({ success: true });
}
