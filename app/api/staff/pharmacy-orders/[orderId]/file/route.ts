import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { requirePharmacyStaff } from "@/src/lib/pharmacy-staff-auth";
import { getOrderPdfPath } from "@/src/lib/pharmacy-prescription-order-service";

type RouteParams = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const staff = await requirePharmacyStaff(req);
  if (!staff) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { orderId: orderIdRaw } = await params;
  const orderId = Number(orderIdRaw);
  const row = await getOrderPdfPath(orderId);

  if (!row?.pdf_file_path) {
    return NextResponse.json({ success: false, message: "PDF tidak tersedia" }, { status: 404 });
  }

  try {
    const buffer = await readFile(row.pdf_file_path);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="resep.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "File tidak ditemukan" }, { status: 404 });
  }
}
