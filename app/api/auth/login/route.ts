import { NextRequest, NextResponse } from "next/server";
import { authenticatePatient } from "@/src/lib/patient-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier =
      body.identifier?.trim() ||
      body.email?.trim() ||
      body.username?.trim();
    const password = body.password;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: "Email/username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const result = await authenticatePatient({ identifier, password });

    if ("error" in result) {
      return NextResponse.json(
        {
          success: false,
          message: "Email/username atau password salah.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      user: {
        id: String(result.patientId),
        patientId: result.patientId,
        name: result.name,
        medicalRecordNumber: result.noRm,
        email: result.email,
        username: result.username,
      },
    });
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
