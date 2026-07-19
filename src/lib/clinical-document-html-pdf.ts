import type { ConsultationSummaryDocument } from "@/src/types/consultation-summary";
import type { PrescriptionDocumentData } from "@/src/types/prescription";
import { renderConsultationSummaryHtml } from "@/src/lib/consultation-summary";
import { renderPrescriptionHtml } from "@/src/lib/prescription";
import { readYarsisLogoPng } from "@/src/lib/yarsis-logo-asset";
import { clinicalPdfFilename, renderHtmlToPdf } from "@/src/lib/html-to-pdf";

export { clinicalPdfFilename };

async function inlineLogoDataUri(): Promise<string | undefined> {
  const bytes = await readYarsisLogoPng();
  if (!bytes) return undefined;
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/** PDF ringkasan — layout sama persis dengan dokumen HTML (cetak browser). */
export async function generateConsultationSummaryPdf(
  doc: ConsultationSummaryDocument
): Promise<Uint8Array> {
  const html = renderConsultationSummaryHtml(doc, {
    embed: true,
    pdf: true,
    inlineLogoDataUri: await inlineLogoDataUri(),
  });
  const pdf = await renderHtmlToPdf(html);
  return new Uint8Array(pdf);
}

/** PDF resep — layout sama persis dengan dokumen HTML (cetak browser). */
export async function generatePrescriptionPdf(
  doc: PrescriptionDocumentData
): Promise<Uint8Array> {
  const html = renderPrescriptionHtml(doc, {
    embed: true,
    pdf: true,
    inlineLogoDataUri: await inlineLogoDataUri(),
  });
  const pdf = await renderHtmlToPdf(html);
  return new Uint8Array(pdf);
}
