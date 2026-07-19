import { NextRequest, NextResponse } from "next/server";
import { authenticateStaff, createStaffSession } from "@/src/lib/staff-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier =
      body.identifier?.trim() || body.email?.trim() || body.username?.trim();
    const password = body.password;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: "Username/email dan password wajib diisi" },
        { status: 400 }
      );
    }

    const result = await authenticateStaff({ identifier, password });
    if ("error" in result) {
      return NextResponse.json(
        { success: false, message: "Username/email atau password salah." },
        { status: 401 }
      );
    }

    const session = await createStaffSession(result.staff.id);

    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      staff: result.staff,
      sessionToken: session.token,
    });
  } catch (error) {
    console.error("[staff/auth/login]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
