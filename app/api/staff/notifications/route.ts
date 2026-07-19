import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/src/lib/staff-api-auth";
import {
  countUnreadNotifications,
  listStaffNotifications,
  markAllNotificationsRead,
} from "@/src/lib/staff-notification-service";

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    listStaffNotifications(staff.id),
    countUnreadNotifications(staff.id),
  ]);

  return NextResponse.json({
    success: true,
    notifications,
    unreadCount,
  });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "read_all") {
    await markAllNotificationsRead(staff.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, message: "action tidak dikenal" }, { status: 400 });
}
