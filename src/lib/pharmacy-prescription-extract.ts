import { readFile } from "fs/promises";
import { getSessionPrescription } from "@/src/lib/prescription";
import type { ConsultationPrescription, PrescriptionMedication } from "@/src/types/prescription";
import type { SavePharmacyOrderItemInput } from "@/src/types/pharmacy-order";

const PDF_JUNK = new Set([
  "FlateDecode",
  "ASCIIHexDecode",
  "ASCII85Decode",
  "LZWDecode",
  "RunLengthDecode",
  "CCITTFaxDecode",
  "DCTDecode",
  "JPXDecode",
  "JBIG2Decode",
  "Length",
  "Filter",
  "Type",
  "Subtype",
  "Font",
  "Contents",
  "Page",
  "Catalog",
  "XObject",
  "stream",
  "endstream",
  "Adobe",
  "Skia",
  "PDF",
]);

/** Ekstrak teks PDF via pdf-parse (pdf.js) — andal untuk resep DARSI hasil print/save PDF. */
export async function extractPlainTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

export async function extractPlainTextFromPdfPath(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return extractPlainTextFromPdfBuffer(buffer);
}

function inferUnitFromText(text: string): string {
  const m = text.toLowerCase();
  if (/\btablet\b|\bkaplet\b|\btab\b/.test(m)) return "tablet";
  if (/\bkapsul\b|\bcapsule\b/.test(m)) return "kapsul";
  if (/\bsachet\b|\bsache\b/.test(m)) return "sachet";
  if (/\bbotol\b|\bbottle\b/.test(m)) return "botol";
  if (/\btube\b/.test(m)) return "tube";
  if (/\bml\b|\btetes\b/.test(m)) return "ml";
  if (/\bstrip\b/.test(m)) return "strip";
  return "unit";
}

function parseQuantityLine(line: string): { quantity: string; unit: string } | null {
  const noMatch = line.match(/^No\.?\s*(.+)$/i);
  if (!noMatch) return null;
  const rest = noMatch[1].trim();
  const numMatch = rest.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/i);
  if (!numMatch) return { quantity: rest, unit: inferUnitFromText(rest) };
  const qty = numMatch[1].replace(",", ".");
  const unitPart = numMatch[2].trim();
  return {
    quantity: qty,
    unit: unitPart ? inferUnitFromText(unitPart) || unitPart : "unit",
  };
}

function looksLikeDrugName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  if (PDF_JUNK.has(trimmed)) return false;
  if (/decode|endobj|xref|trailer|obj\b|filter\b|length\b/i.test(trimmed)) return false;
  if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(trimmed)) return false;
  if (/^(resep|diagnosis|pasien|dokter|surabaya|verifikasi|kontrol)/i.test(trimmed)) return false;
  return true;
}

function medicationToItem(med: PrescriptionMedication): SavePharmacyOrderItemInput {
  const drugName = [med.name, med.strength].filter(Boolean).join(" ").trim();
  const qtyParsed = med.quantity ? parseQuantityLine(`No. ${med.quantity}`) : null;

  return {
    drugName,
    quantity: qtyParsed?.quantity ?? "1",
    unit: qtyParsed?.unit ?? inferUnitFromText(med.dosage || med.route || med.quantity || ""),
    unitPrice: 0,
    availabilityStatus: "available",
    note: [
      `S. ${med.dosage}`,
      med.frequency,
      med.route,
      med.duration ? `selama ${med.duration}` : null,
      med.notes,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function itemsFromDarsiPrescription(
  prescription: ConsultationPrescription
): SavePharmacyOrderItemInput[] {
  return prescription.medications.filter((m) => m.name?.trim()).map((m) => medicationToItem(m));
}

function parseDrugLine(line: string): string {
  return line.replace(/^\d+\.\s*/, "").trim();
}

function trimRxBlock(block: string): string {
  return block.split(/\n\s*(?:KONTROL ULANG|Verifikasi Resep|DARSI E-PRESCRIPTION|SURABAYA,)/i)[0];
}

function parseRxBlock(block: string): SavePharmacyOrderItemInput | null {
  const stopPattern =
    /^(KONTROL|Verifikasi|CATATAN UMUM|DARSI|SURABAYA|dr\.|Tenaga|Resep elektronik)/i;
  const lines = trimRxBlock(block)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !stopPattern.test(l));

  if (!lines.length) return null;

  const drugName = parseDrugLine(lines[0]);
  if (!looksLikeDrugName(drugName)) return null;

  let quantity = "1";
  let unit = "unit";
  const noteParts: string[] = [];

  for (const line of lines.slice(1)) {
    const qty = parseQuantityLine(line);
    if (qty) {
      quantity = qty.quantity;
      unit = qty.unit;
      continue;
    }
    if (/^S\.?\s*/i.test(line)) {
      noteParts.push(line.replace(/^S\.?\s*/i, "S. "));
      const inferred = inferUnitFromText(line);
      if (inferred !== "unit") unit = inferred;
      const numInSig = line.match(
        /(\d+(?:[.,]\d+)?)\s*(tablet|kaplet|kapsul|ml|tetes|sachet|strip|botol)/i
      );
      if (numInSig && quantity === "1") quantity = numInSig[1].replace(",", ".");
      continue;
    }
    if (/^catatan:/i.test(line)) {
      noteParts.push(line);
    }
  }

  return {
    drugName,
    quantity,
    unit,
    unitPrice: 0,
    availabilityStatus: "available",
    note: noteParts.join(" · ") || undefined,
  };
}

/**
 * Parser teks resep DARSI — format:
 * R/ 1. Oralit 100
 * No. 2
 * S. 1 tablet, 3x sehari, Oral, selama 5 hari
 */
export function parsePrescriptionTextToItems(text: string): SavePharmacyOrderItemInput[] {
  if (!text.trim()) return [];

  const normalized = text.replace(/\r\n/g, "\n");
  const items: SavePharmacyOrderItemInput[] = [];

  // Hanya match R/ di awal baris diikuti nomor obat (hindari "(R/)" di header)
  const blocks = normalized.split(/(?:^|\n)\s*R\s*\/\s*(?=\d+\.\s)/im).slice(1);

  for (const block of blocks) {
    const item = parseRxBlock(block);
    if (item) items.push(item);
  }

  if (items.length > 0) return items;

  // Fallback: R/ tanpa nomor di baris yang sama
  const inlineBlocks = normalized.split(/(?:^|\n)\s*R\s*\/\s+/im).slice(1);
  for (const block of inlineBlocks) {
    const item = parseRxBlock(block);
    if (item) items.push(item);
  }

  return items.filter((item) => looksLikeDrugName(item.drugName));
}

export async function extractItemsForPharmacyOrder(input: {
  sourceType: string;
  sourceConsultationSessionId: number | null;
  pdfFilePath: string | null;
}): Promise<SavePharmacyOrderItemInput[]> {
  if (input.sourceType === "darsi_prescription" && input.sourceConsultationSessionId) {
    const prescription = await getSessionPrescription(input.sourceConsultationSessionId);
    if (prescription?.medications?.length) {
      return itemsFromDarsiPrescription(prescription);
    }
  }

  if (input.pdfFilePath) {
    try {
      const text = await extractPlainTextFromPdfPath(input.pdfFilePath);
      const parsed = parsePrescriptionTextToItems(text);
      if (parsed.length > 0) return parsed;

      if (input.sourceConsultationSessionId) {
        const prescription = await getSessionPrescription(input.sourceConsultationSessionId);
        if (prescription?.medications?.length) {
          return itemsFromDarsiPrescription(prescription);
        }
      }
    } catch {
      /* fall through */
    }
  }

  return [];
}
