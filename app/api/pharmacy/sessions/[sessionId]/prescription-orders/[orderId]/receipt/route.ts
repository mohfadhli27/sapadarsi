import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import {
  ensurePharmacyReceiptPdf,
  getOrderReceiptPdfPath,
} from "@/src/lib/pharmacy-prescription-order-service";

type RouteParams = { params: Promise<{ sessionId: string; orderId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { orderId: orderIdRaw } = await params;
  const orderId = Number(orderIdRaw);
  const patientId = Number(req.nextUrl.searchParams.get("patientId"));

  if (!orderId || !patientId) {
    return NextResponse.json(
      { success: false, message: "orderId dan patientId wajib" },
      { status: 400 }
    );
  }

  const row =
    (await ensurePharmacyReceiptPdf(orderId, patientId)) ??
    (await getOrderReceiptPdfPath(orderId, patientId));

  if (!row?.receipt_pdf_path) {
    return NextResponse.json({ success: false, message: "Resi PDF belum tersedia" }, { status: 404 });
  }

  try {
    const buffer = await readFile(row.receipt_pdf_path);
    const fileName = row.receipt_pdf_file_name ?? `resi-${orderId}.pdf`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "File resi tidak ditemukan" }, { status: 404 });
  }
}
