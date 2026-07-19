import { NextRequest, NextResponse } from "next/server";
import {
  getDoctorConsultationDetail,
  pollSessionStatus,
  refreshSessionDoctors,
  runDoctorTriage,
  selectDoctor,
} from "@/src/lib/doctor-consultation-service";
import type { RsiUnitType } from "@/src/lib/rsi-api";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const patientId = Number(req.nextUrl.searchParams.get("patientId"));
    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }

    if (req.nextUrl.searchParams.get("detail") === "1") {
      const detail = await getDoctorConsultationDetail(Number(sessionId), patientId);
      return NextResponse.json({ success: true, ...detail });
    }

    if (req.nextUrl.searchParams.get("refreshDoctors") === "1") {
      const refreshed = await refreshSessionDoctors(Number(sessionId), patientId);
      return NextResponse.json({ success: true, ...refreshed });
    }

    const status = await pollSessionStatus(Number(sessionId), patientId);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal cek status" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await req.json();
    const action = body.action as string;
    const patientId = Number(body.patientId);
    const sid = Number(sessionId);

    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }

    if (action === "triage") {
      const result = await runDoctorTriage({
        sessionId: sid,
        patientId,
        complaint: String(body.complaint ?? ""),
        unitType: body.unitType as RsiUnitType | undefined,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "select_doctor") {
      const result = await selectDoctor({
        sessionId: sid,
        patientId,
        doctor: body.doctor,
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ success: false, message: "action tidak dikenal" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memproses" },
      { status: 500 }
    );
  }
}
