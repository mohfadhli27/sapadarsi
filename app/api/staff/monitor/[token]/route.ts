import { NextRequest, NextResponse } from "next/server";
import {
  getVisibleMessages,
  staffEditMessage,
  staffHideMessage,
  staffTakeoverMessage,
  setDoctorTakeoverMode,
} from "@/src/lib/doctor-consultation-service";
import { saveSessionPrescription } from "@/src/lib/prescription";
import type { SavePrescriptionInput } from "@/src/types/prescription";
import {
  approveStaffSession,
  getStaffMonitorSession,
  rejectStaffSession,
} from "@/src/lib/staff-session-access";
import { mapVisibleMessageForMonitor } from "@/src/lib/monitor-messages";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const session = await getStaffMonitorSessionByToken(token);
    const messages = await getVisibleMessages(session.row.id);
    return NextResponse.json({
      success: true,
      session: session.row,
      meta: session.meta,
      patient: session.patient,
      messages: messages.map(mapVisibleMessageForMonitor),
      staffActor: session.meta.doctor_name ?? "Tenaga Medis",
      sessionKind: session.sessionKind,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Sesi tidak ditemukan" },
      { status: 404 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await req.json();
    const session = await getStaffMonitorSessionByToken(token);
    const sid = session.row.id;
    const actor = String(body.actor ?? session.meta.doctor_name ?? "Tenaga Medis");
    const action = String(body.action ?? "");

    if (action === "approve") {
      const result = await approveStaffSession(sid, actor);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "reject") {
      const result = await rejectStaffSession(sid, actor, body.reason ? String(body.reason) : undefined);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "edit_message") {
      await staffEditMessage({
        messageId: Number(body.messageId),
        editedText: String(body.editedText ?? ""),
        actor,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "hide_message") {
      await staffHideMessage(Number(body.messageId), actor);
      return NextResponse.json({ success: true });
    }

    if (action === "takeover") {
      await staffTakeoverMessage({
        sessionId: sid,
        message: String(body.message ?? ""),
        actor,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "enable_takeover") {
      const result = await setDoctorTakeoverMode(sid, true);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "disable_takeover") {
      const result = await setDoctorTakeoverMode(sid, false);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "save_prescription") {
      const prescription = await saveSessionPrescription({
        sessionId: sid,
        actor,
        data: body.prescription as SavePrescriptionInput,
      });
      return NextResponse.json({ success: true, prescription });
    }

    return NextResponse.json({ success: false, message: "action tidak dikenal" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memproses" },
      { status: 500 }
    );
  }
}

async function getStaffMonitorSessionByToken(token: string) {
  const { dbQuery } = await import("@/src/lib/db");
  const metaResult = await dbQuery<{ session_id: number }>(
    `select session_id from doctor_consultation_meta where monitor_token = $1 limit 1`,
    [token]
  );
  const sessionId = metaResult.rows[0]?.session_id;
  if (!sessionId) throw new Error("Sesi monitor tidak ditemukan");
  return getStaffMonitorSession(sessionId);
}
