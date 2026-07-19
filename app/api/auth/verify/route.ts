import { NextRequest, NextResponse } from "next/server";

/**
 * Placeholder token verification endpoint.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, message: "Token tidak valid" },
      { status: 401 }
    );
  }

  // --- PLACEHOLDER: replace with real JWT verification ---
  return NextResponse.json({
    success: true,
    message: "Token valid",
    user: {
      id: "usr-001",
      name: "Pasien Demo",
      email: "demo@darsi.id",
      userType: "patient",
    },
  });
}
