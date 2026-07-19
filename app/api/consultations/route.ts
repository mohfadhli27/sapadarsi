import { NextRequest, NextResponse } from "next/server";
import { createConsultationSession } from "@/src/lib/consultation-service";
import type { ConsultationServiceType } from "@/src/config/consultation";

const VALID_TYPES: ConsultationServiceType[] = ["nurse_consultation", "midwife_consultation"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientId = Number(body.patientId);
    const serviceType = body.serviceType as ConsultationServiceType;
    const initialComplaint = typeof body.initialComplaint === "string" ? body.initialComplaint : undefined;

    if (!patientId || !VALID_TYPES.includes(serviceType)) {
      return NextResponse.json(
        { success: false, message: "patientId dan serviceType wajib diisi" },
        { status: 400 }
      );
    }

    const result = await createConsultationSession({
      patientId,
      serviceType,
      initialComplaint,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[consultations/create]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal membuat sesi konsultasi",
      },
      { status: 500 }
    );
  }
}
