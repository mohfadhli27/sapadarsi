import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/admin-api-auth";
import { listAdminStaff, updateStaffAccount } from "@/src/lib/admin-service";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
  }

  try {
    const staff = await listAdminStaff();
    return NextResponse.json({ success: true, staff });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ success: false, message: "id wajib" }, { status: 400 });
    }

    const updated = await updateStaffAccount(id, {
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      phone: body.phone !== undefined ? body.phone : undefined,
      role: typeof body.role === "string" ? body.role : undefined,
    });

    if (!updated) {
      return NextResponse.json({ success: false, message: "Tidak ada perubahan" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal menyimpan" },
      { status: 500 }
    );
  }
}
