import { NextRequest, NextResponse } from "next/server";
import {
  createUploadedPrescriptionOrder,
  listPharmacyPrescriptionOrdersForPatient,
} from "@/src/lib/pharmacy-prescription-order-service";
import { savePharmacyPdfFile } from "@/src/lib/pharmacy-prescription-upload";

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { sessionId: sessionIdRaw } = await params;
  const sessionId = Number(sessionIdRaw);
  const patientId = Number(req.nextUrl.searchParams.get("patientId"));

  if (!sessionId || !patientId) {
    return NextResponse.json(
      { success: false, message: "sessionId dan patientId wajib" },
      { status: 400 }
    );
  }

  try {
    const orders = await listPharmacyPrescriptionOrdersForPatient(patientId, sessionId);
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat order" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { sessionId: sessionIdRaw } = await params;
  const sessionId = Number(sessionIdRaw);

  try {
    const form = await req.formData();
    const patientId = Number(form.get("patientId"));
    const patientNote = String(form.get("patientNote") ?? "").trim() || undefined;
    const file = form.get("file");

    if (!sessionId || !patientId) {
      return NextResponse.json(
        { success: false, message: "sessionId dan patientId wajib" },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "File PDF wajib diupload" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, message: "Hanya file PDF yang diterima" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const draft = await createUploadedPrescriptionOrder({
      sessionId,
      patientId,
      patientNote,
    });

    const saved = await savePharmacyPdfFile({
      buffer,
      originalName: file.name,
      patientId,
      orderId: draft.id,
    });

    const { dbQuery } = await import("@/src/lib/db");
    await dbQuery(
      `UPDATE pasienkonsul.pharmacy_prescription_orders
       SET pdf_file_name = $2, pdf_file_path = $3, pdf_mime_type = $4, pdf_size_bytes = $5
       WHERE id = $1`,
      [draft.id, saved.displayName, saved.storedPath, saved.mimeType, saved.sizeBytes]
    );

    const { getPharmacyPrescriptionOrderDetail } = await import(
      "@/src/lib/pharmacy-prescription-order-service"
    );
    const order = await getPharmacyPrescriptionOrderDetail(draft.id);

    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Upload gagal" },
      { status: 400 }
    );
  }
}
