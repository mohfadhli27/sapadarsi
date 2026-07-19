import { NextRequest, NextResponse } from "next/server";
import { getPharmacySessionMessages } from "@/src/lib/pharmacy-nemotron-agent";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId: rawId } = await params;
  const sessionId = Number(rawId);
  const patientId = Number(req.nextUrl.searchParams.get("patientId"));

  if (!sessionId || !patientId) {
    return NextResponse.json(
      { success: false, message: "sessionId dan patientId wajib" },
      { status: 400 }
    );
  }

  try {
    const messages = await getPharmacySessionMessages(sessionId, patientId);
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal memuat pesan",
      },
      { status: 500 }
    );
  }
}
