import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/src/lib/doctor-consultation-service";
import {
  buildConsultationSummaryDocument,
  renderConsultationSummaryHtml,
} from "@/src/lib/consultation-summary";
import {
  clinicalPdfFilename,
  generateConsultationSummaryPdf,
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

    await getDoctorSession(sid, patientId);

    const doc = await buildConsultationSummaryDocument(sid, patientId, "doctor_consultation");
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Data ringkasan tidak lengkap" },
        { status: 404 }
      );
    }

    if (format === "json") {
      return NextResponse.json({ success: true, summary: doc });
    }

    if (format === "pdf") {
      const pdf = await generateConsultationSummaryPdf(doc);
      const filename = clinicalPdfFilename("ringkasan", doc.documentNo);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const embed = req.nextUrl.searchParams.get("embed") === "1";
    const html = renderConsultationSummaryHtml(doc, { embed });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal memuat ringkasan konsultasi",
      },
      { status: 500 }
    );
  }
}
