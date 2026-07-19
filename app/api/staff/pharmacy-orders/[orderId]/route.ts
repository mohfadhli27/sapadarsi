import { NextRequest, NextResponse } from "next/server";
import { requirePharmacyStaff } from "@/src/lib/pharmacy-staff-auth";
import {
  getPharmacyPrescriptionOrderDetail,
  startPharmacyOrderReview,
  updatePharmacyOrderPricing,
} from "@/src/lib/pharmacy-prescription-order-service";
import type { SavePharmacyOrderItemInput } from "@/src/types/pharmacy-order";

type RouteParams = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const staff = await requirePharmacyStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { orderId: orderIdRaw } = await params;
  const orderId = Number(orderIdRaw);
  if (!orderId) {
    return NextResponse.json({ success: false, message: "orderId wajib" }, { status: 400 });
  }

  const order = await getPharmacyPrescriptionOrderDetail(orderId, true, { autoImport: true });
  if (!order) {
    return NextResponse.json({ success: false, message: "Order tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ success: true, order });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const staff = await requirePharmacyStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { orderId: orderIdRaw } = await params;
  const orderId = Number(orderIdRaw);

  try {
    const body = await req.json();
    const action = body.action as string | undefined;

    if (action === "start_review") {
      const order = await startPharmacyOrderReview(orderId, staff.displayName);
      return NextResponse.json({ success: true, order });
    }

    const items = body.items as SavePharmacyOrderItemInput[] | undefined;
    const pharmacistNote = body.pharmacistNote as string | undefined;

    if (!items?.length) {
      return NextResponse.json({ success: false, message: "items wajib diisi" }, { status: 400 });
    }

    const order = await updatePharmacyOrderPricing({ orderId, items, pharmacistNote });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Update gagal" },
      { status: 400 }
    );
  }
}
