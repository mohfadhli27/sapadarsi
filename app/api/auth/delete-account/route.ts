import { NextRequest, NextResponse } from "next/server";
import { deletePatientAccount } from "@/src/lib/patient-account";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientId = Number(body.patientId);
    const password = String(body.password ?? "");

    if (!patientId || !password) {
      return NextResponse.json(
        { success: false, message: "patientId dan password wajib diisi" },
        { status: 400 }
      );
    }

    await deletePatientAccount({ patientId, password });

    return NextResponse.json({
      success: true,
      message:
        "Akun login berhasil dihapus. Riwayat konsultasi dapat tetap disimpan sesuai kebijakan rumah sakit.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal menghapus akun",
      },
      { status: 400 }
    );
  }
}
