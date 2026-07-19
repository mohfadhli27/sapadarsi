import { NextRequest, NextResponse } from "next/server";
import { requirePharmacyStaff } from "@/src/lib/pharmacy-staff-auth";
import {
  getPharmacyPrescriptionOrderDetail,
  importPrescriptionItemsToOrder,
} from "@/src/lib/pharmacy-prescription-order-service";
import { NEW_ORDER_STATUSES } from "@/src/lib/pharmacy-order-status";

type RouteParams = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const staff = await requirePharmacyStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { orderId: orderIdRaw } = await params;
  const orderId = Number(orderIdRaw);

  try {
    const body = await req.json().catch(() => ({}));
    const force = Boolean((body as { force?: boolean }).force);

    const existing = await getPharmacyPrescriptionOrderDetail(orderId);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan" }, { status: 404 });
    }
    if (!NEW_ORDER_STATUSES.includes(existing.status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Baca ulang resep hanya untuk pesanan di tab Baru masuk",
        },
        { status: 400 }
      );
    }

    const result = await importPrescriptionItemsToOrder(orderId, {
      force,
      actorName: staff.displayName,
    });
    const order = await getPharmacyPrescriptionOrderDetail(orderId);

    return NextResponse.json({
      success: true,
      imported: result.imported,
      itemCount: result.itemCount,
      order,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal membaca resep",
      },
      { status: 400 }
    );
  }
}
