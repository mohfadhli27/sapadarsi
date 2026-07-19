import { NextRequest, NextResponse } from "next/server";
import {
  completeDoctorSession,
  getDoctorSession,
  getVisibleMessages,
  sendDoctorChatMessage,
} from "@/src/lib/doctor-consultation-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const patientId = Number(req.nextUrl.searchParams.get("patientId"));
    const messages = await getVisibleMessages(Number(sessionId));

    if (patientId) {
      await getDoctorSession(Number(sessionId), patientId);
    }

    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        senderName: m.senderName,
        createdAt: m.createdAt,
        suggestNewConsultation: m.suggestNewConsultation,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat pesan" },
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
    const message = String(body.message ?? "").trim();

    if (!patientId || !message) {
      return NextResponse.json(
        { success: false, message: "patientId dan message wajib diisi" },
        { status: 400 }
      );
    }

    const aiResponse = await sendDoctorChatMessage({
      sessionId: Number(sessionId),
      patientId,
      message,
    });

    return NextResponse.json({ success: true, ...aiResponse });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal mengirim pesan" },
      { status: 500 }
    );
  }
}

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
    const result = await completeDoctorSession(Number(sessionId), patientId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal menutup sesi" },
      { status: 500 }
    );
  }
}
