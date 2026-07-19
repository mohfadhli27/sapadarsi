import { NextRequest, NextResponse } from "next/server";
import { listPatientDoctorSessions } from "@/src/lib/doctor-consultation-service";

export async function GET(req: NextRequest) {
  try {
    const patientId = Number(req.nextUrl.searchParams.get("patientId"));
    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }
    const sessions = await listPatientDoctorSessions(patientId);
    return NextResponse.json({ success: true, sessions, threads: sessions });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat" },
      { status: 500 }
    );
  }
}
