import { NextRequest, NextResponse } from "next/server";
import { submitPatientDecision } from "@/src/lib/pharmacy-prescription-order-service";

type RouteParams = { params: Promise<{ sessionId: string; orderId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { orderId: orderIdRaw } = await params;
  const orderId = Number(orderIdRaw);

  try {
    const body = await req.json();
    const patientId = Number(body.patientId);
    const decision = body.decision as "delivery" | "pickup" | "cancel";
    const deliveryAddress = body.deliveryAddress as string | undefined;

    if (!orderId || !patientId || !decision) {
      return NextResponse.json(
        { success: false, message: "orderId, patientId, dan decision wajib" },
        { status: 400 }
      );
    }

    if (!["delivery", "pickup", "cancel"].includes(decision)) {
      return NextResponse.json({ success: false, message: "Decision tidak valid" }, { status: 400 });
    }

    const order = await submitPatientDecision({
      orderId,
      patientId,
      decision,
      deliveryAddress,
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan keputusan" },
      { status: 400 }
    );
  }
}
