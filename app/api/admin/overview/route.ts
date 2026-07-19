import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/admin-api-auth";
import { getAdminOverview } from "@/src/lib/admin-service";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
  }

  try {
    const overview = await getAdminOverview();
    return NextResponse.json({ success: true, overview });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat" },
      { status: 500 }
    );
  }
}
