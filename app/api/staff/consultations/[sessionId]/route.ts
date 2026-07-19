import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/src/lib/staff-api-auth";
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
  staffCanAccessSession,
} from "@/src/lib/staff-session-access";
import { mapVisibleMessageForMonitor } from "@/src/lib/monitor-messages";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const staff = await requireStaff(req);
    if (!staff) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await context.params;
    const sid = Number(sessionId);

    const allowed = await staffCanAccessSession(staff, sid);
    if (!allowed) {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    const session = await getStaffMonitorSession(sid);
    const messages = await getVisibleMessages(sid);

    return NextResponse.json({
      success: true,
      session: session.row,
      meta: session.meta,
      patient: session.patient,
      messages: messages.map(mapVisibleMessageForMonitor),
      staffActor: staff.displayName,
      sessionKind: session.sessionKind,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat" },
      { status: 404 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const staff = await requireStaff(req);
    if (!staff) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await context.params;
    const sid = Number(sessionId);
    const allowed = await staffCanAccessSession(staff, sid);
    if (!allowed) {
      return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
    }

    const body = await req.json();
    const actor = String(body.actor ?? staff.displayName);
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
