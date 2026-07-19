import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/src/lib/staff-api-auth";
import { listStaffConsultations } from "@/src/lib/doctor-consultation-service";

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const consultations = await listStaffConsultations(staff);
    return NextResponse.json({ success: true, consultations });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat" },
      { status: 500 }
    );
  }
}
