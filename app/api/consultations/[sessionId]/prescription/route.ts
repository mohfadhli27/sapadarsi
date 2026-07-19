import { NextRequest, NextResponse } from "next/server";
import {
  buildPrescriptionDocument,
  getSessionPrescription,
  renderPrescriptionHtml,
  verifyPatientPrescriptionAccess,
} from "@/src/lib/prescription";
import {
  clinicalPdfFilename,
  generatePrescriptionPdf,
} from "@/src/lib/clinical-document-html-pdf";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const patientId = Number(req.nextUrl.searchParams.get("patientId"));
    const sid = Number(sessionId);
    const format = req.nextUrl.searchParams.get("format");

    if (!patientId) {
      return NextResponse.json(
        { success: false, message: "patientId wajib diisi" },
        { status: 400 }
      );
    }

    await verifyPatientPrescriptionAccess(sid, patientId);
    const prescription = await getSessionPrescription(sid);
    if (!prescription) {
      return NextResponse.json(
        { success: false, message: "Resep belum diterbitkan untuk sesi ini" },
        { status: 404 }
      );
    }

    if (format === "json") {
      return NextResponse.json({ success: true, prescription });
    }

    const doc = await buildPrescriptionDocument(sid, patientId);
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Data resep tidak lengkap" },
        { status: 404 }
      );
    }

    if (format === "pdf") {
      const pdf = await generatePrescriptionPdf(doc);
      const filename = clinicalPdfFilename("resep", doc.prescription.prescriptionNo);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const embed = req.nextUrl.searchParams.get("embed") === "1";
    const html = renderPrescriptionHtml(doc, { embed });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat resep" },
      { status: 500 }
    );
  }
}
