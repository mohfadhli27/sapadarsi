import { NextRequest, NextResponse } from "next/server";
import { requirePharmacyStaff } from "@/src/lib/pharmacy-staff-auth";
import { listPharmacyPrescriptionOrdersForStaff } from "@/src/lib/pharmacy-prescription-order-service";

export async function GET(req: NextRequest) {
  const staff = await requirePharmacyStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  try {
    const orders = await listPharmacyPrescriptionOrdersForStaff(status ?? undefined);
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat order" },
      { status: 500 }
    );
  }
}
