import { NextRequest, NextResponse } from "next/server";
import {
  createPharmacySession,
  listPharmacySessions,
} from "@/src/lib/pharmacy-nemotron-agent";

export async function GET(req: NextRequest) {
  const patientId = Number(req.nextUrl.searchParams.get("patientId"));
  if (!patientId) {
    return NextResponse.json(
      { success: false, message: "patientId wajib" },
      { status: 400 }
    );
  }

  try {
    const sessions = await listPharmacySessions(patientId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal memuat sesi",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientId = Number(body.patientId);
    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib" },
        { status: 400 }
      );
    }

    const session = await createPharmacySession(patientId);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal membuat sesi",
      },
      { status: 500 }
    );
  }
}
