import { NextRequest, NextResponse } from "next/server";
import {
  getSessionMessages,
  sendConsultationMessage,
} from "@/src/lib/consultation-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await req.json();
    const patientId = Number(body.patientId);
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!patientId || !message) {
      return NextResponse.json(
        { success: false, message: "patientId dan message wajib diisi" },
        { status: 400 }
      );
    }

    const aiResponse = await sendConsultationMessage({
      sessionId: Number(sessionId),
      patientId,
      message,
    });

    return NextResponse.json(aiResponse);
  } catch (error) {
    console.error("[consultations/messages]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal mengirim pesan",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const messages = await getSessionMessages(Number(sessionId));
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[consultations/messages/get]", error);
    return NextResponse.json(
      { success: false, message: "Gagal memuat pesan" },
      { status: 500 }
    );
  }
}
