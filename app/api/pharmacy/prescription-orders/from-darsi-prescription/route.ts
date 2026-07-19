import { NextRequest, NextResponse } from "next/server";
import { createPharmacySession } from "@/src/lib/pharmacy-nemotron-agent";
import { createDarsiPrescriptionOrder } from "@/src/lib/pharmacy-prescription-order-service";
import {
  buildPharmacyPatientChatUrl,
  pharmacyPatientPublicUrl,
} from "@/src/lib/session-app-origin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientId = Number(body.patientId);
    const sourceConsultationSessionId = Number(body.sourceConsultationSessionId);
    let pharmacySessionId = Number(body.pharmacySessionId);

    if (!patientId || !sourceConsultationSessionId) {
      return NextResponse.json(
        { success: false, message: "patientId dan sourceConsultationSessionId wajib" },
        { status: 400 }
      );
    }

    if (!pharmacySessionId) {
      const session = await createPharmacySession(patientId, {
        appOriginUrl: pharmacyPatientPublicUrl(),
      });
      pharmacySessionId = session.id;
    }

    const order = await createDarsiPrescriptionOrder({
      pharmacySessionId,
      patientId,
      sourceConsultationSessionId,
    });

    return NextResponse.json({
      success: true,
      order,
      pharmacySessionId,
      redirectPath: "/chat/apoteker",
      redirectUrl: buildPharmacyPatientChatUrl(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal mengirim resep" },
      { status: 400 }
    );
  }
}
