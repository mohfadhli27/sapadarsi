import { NextRequest, NextResponse } from "next/server";
import { completeMidwifeSession } from "@/src/lib/consultation-service";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await req.json();
    const patientId = Number(body.patientId);

    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }

    const session = await completeMidwifeSession(Number(sessionId), patientId);
    return NextResponse.json({ success: true, status: "completed", summaryCard: session.summaryCard });
  } catch (error) {
    console.error("[consultations/complete]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal menutup sesi",
      },
      { status: 500 }
    );
  }
}
