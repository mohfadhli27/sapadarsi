import { NextRequest, NextResponse } from "next/server";
import { getPatientMidwifeSessionView } from "@/src/lib/consultation-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const patientId = Number(req.nextUrl.searchParams.get("patientId"));
    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }

    const { sessionId } = await context.params;
    const sid = Number(sessionId);
    if (!Number.isFinite(sid) || sid <= 0) {
      return NextResponse.json(
        { success: false, message: "sessionId tidak valid" },
        { status: 400 }
      );
    }

    const data = await getPatientMidwifeSessionView(patientId, sid);

    if (!data.session) {
      return NextResponse.json(
        { success: false, message: "Sesi konsultasi tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat" },
      { status: 500 }
    );
  }
}
