import { NextRequest, NextResponse } from "next/server";
import { deletePharmacyMessage } from "@/src/lib/pharmacy-nemotron-agent";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  const { sessionId: rawSessionId, messageId: rawMessageId } = await params;
  const sessionId = Number(rawSessionId);
  const messageId = Number(rawMessageId);
  const patientId = Number(req.nextUrl.searchParams.get("patientId"));

  if (!sessionId || !messageId || !patientId) {
    return NextResponse.json(
      { success: false, message: "sessionId, messageId, dan patientId wajib" },
      { status: 400 }
    );
  }

  try {
    await deletePharmacyMessage(sessionId, messageId, patientId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal menghapus pesan",
      },
      { status: 500 }
    );
  }
}
