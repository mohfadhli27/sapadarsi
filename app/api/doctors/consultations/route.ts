import { NextRequest, NextResponse } from "next/server";
import {
  createDoctorSession,
  listPatientDoctorConsultations,
} from "@/src/lib/doctor-consultation-service";
import type { RsiUnitType } from "@/src/lib/rsi-api";

export async function GET(req: NextRequest) {
  try {
    const patientId = Number(req.nextUrl.searchParams.get("patientId"));
    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }
    const consultations = await listPatientDoctorConsultations(patientId);
    return NextResponse.json({ success: true, consultations });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientId = Number(body.patientId);
    const initialComplaint = String(body.initialComplaint ?? "").trim();
    const unitType = (body.unitType ?? "reguler") as RsiUnitType;

    if (!patientId || !initialComplaint) {
      return NextResponse.json(
        { success: false, message: "patientId dan initialComplaint wajib diisi" },
        { status: 400 }
      );
    }

    const result = await createDoctorSession({
      patientId,
      initialComplaint,
      unitType,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal membuat sesi dokter",
      },
      { status: 500 }
    );
  }
}
