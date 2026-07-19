import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/src/lib/db";
import {
  getSessionMessages,
  runMidwifeTriage,
  selectMidwifePractitioner,
  refreshMidwifePractitioners,
  getMidwifeVisibleMessages,
} from "@/src/lib/consultation-service";
import { getSessionPrescription } from "@/src/lib/prescription";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const patientId = Number(req.nextUrl.searchParams.get("patientId"));
    const sid = Number(sessionId);

    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }

    if (req.nextUrl.searchParams.get("refreshPractitioners") === "1") {
      const refreshed = await refreshMidwifePractitioners(sid, patientId);
      return NextResponse.json({ success: true, ...refreshed });
    }

    const sessionResult = await dbQuery<{
      id: number;
      patient_id: number | null;
      session_type: string;
      status: string;
      initial_complaint: string | null;
    }>(
      `select id, patient_id, session_type, status, initial_complaint
       from chat_sessions where id = $1 limit 1`,
      [sid]
    );
    const session = sessionResult.rows[0];
    if (!session) {
      return NextResponse.json({ success: false, message: "Sesi tidak ditemukan" }, { status: 404 });
    }
    if (session.patient_id !== patientId) {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    const rows = await getMidwifeVisibleMessages(sid);
    const prescription = await getSessionPrescription(sid);
    const messages = rows.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      senderName: m.senderName,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
    }));

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        sessionType: session.session_type,
        initialComplaint: session.initial_complaint,
      },
      prescription,
      messages,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat sesi" },
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
    const patientId = Number(body.patientId);
    const sid = Number(sessionId);
    const action = String(body.action ?? "");

    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }

    if (action === "triage") {
      const result = await runMidwifeTriage({
        sessionId: sid,
        patientId,
        complaint: String(body.complaint ?? "").trim(),
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "select_practitioner") {
      const result = await selectMidwifePractitioner({
        sessionId: sid,
        patientId,
        practitioner: body.practitioner as RsiDoctorSlot,
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
