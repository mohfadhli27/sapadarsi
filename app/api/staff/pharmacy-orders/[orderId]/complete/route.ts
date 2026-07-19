import { NextRequest, NextResponse } from "next/server";
import { requirePharmacyStaff } from "@/src/lib/pharmacy-staff-auth";
import { completePharmacyOrder } from "@/src/lib/pharmacy-prescription-order-service";

type RouteParams = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const staff = await requirePharmacyStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { orderId: orderIdRaw } = await params;
  const orderId = Number(orderIdRaw);

  try {
    const order = await completePharmacyOrder(orderId, staff.displayName);
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal menyelesaikan order" },
      { status: 400 }
    );
  }
}
