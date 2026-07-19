import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PharmacyOrderItem, PharmacyPatientDecision } from "@/src/types/pharmacy-order";
import { HOSPITAL } from "@/src/lib/prescription";
import { embedYarsisLogoInPdf } from "@/src/lib/yarsis-logo-asset";

export type PharmacyReceiptData = {
  receiptNo: string;
  orderId: number;
  prescriptionNo: string | null;
  patientName: string;
  patientRm: string;
  patientDecision: PharmacyPatientDecision;
  deliveryAddress: string | null;
  items: PharmacyOrderItem[];
  totalPrice: number;
  pharmacistNote: string | null;
  issuedAt: Date;
  diagnosis?: string | null;
};

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateId(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function decisionLabel(decision: PharmacyPatientDecision) {
  if (decision === "delivery") return "Pengantaran ke alamat pasien";
  return "Pengambilan langsung di apotek";
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function buildPharmacyReceiptNo(orderId: number, date = new Date()) {
  const year = date.getFullYear();
  return `RES-${year}-${String(orderId).padStart(5, "0")}`;
}

export async function generatePharmacyReceiptPdf(data: PharmacyReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedYarsisLogoInPdf(doc);

  const margin = 48;
  const pageWidth = 595.28;
  let y = 800;
  const lineHeight = 14;
  const green = rgb(0.02, 0.47, 0.34);
  const logoHeight = 52;
  const headerTop = 812;

  if (logo) {
    const scale = logoHeight / logo.height;
    const logoWidth = logo.width * scale;
    page.drawImage(logo, {
      x: margin,
      y: headerTop - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });

    const textX = margin + logoWidth + 12;
    page.drawText(HOSPITAL.name, {
      x: textX,
      y: headerTop - 16,
      size: 14,
      font: fontBold,
      color: green,
    });
    page.drawText(HOSPITAL.address, {
      x: textX,
      y: headerTop - 30,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    page.drawText(`Telp. ${HOSPITAL.phone} · ${HOSPITAL.website}`, {
      x: textX,
      y: headerTop - 42,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    y = headerTop - logoHeight - 14;
  } else {
    page.drawText(HOSPITAL.name, {
      x: margin,
      y: headerTop - 16,
      size: 14,
      font: fontBold,
      color: green,
    });
    page.drawText(HOSPITAL.address, {
      x: margin,
      y: headerTop - 30,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    page.drawText(`Telp. ${HOSPITAL.phone} · ${HOSPITAL.website}`, {
      x: margin,
      y: headerTop - 42,
      size: 9,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    y = headerTop - 58;
  }

  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 2,
    color: green,
  });
  y -= 18;

  const draw = (text: string, opts?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) => {
    const size = opts?.size ?? 11;
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: opts?.bold ? fontBold : font,
      color: opts?.color ?? rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight + (size > 11 ? 4 : 0);
  };

  const drawRight = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? 10;
    const width = (opts?.bold ? fontBold : font).widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: pageWidth - margin - width,
      y,
      size,
      font: opts?.bold ? fontBold : font,
    });
  };

  draw("RESI PEMESANAN OBAT APOTEK", { bold: true, size: 13, color: green });
  draw(`No. Resi: ${data.receiptNo}`, { bold: true });
  draw(`Tanggal: ${formatDateId(data.issuedAt)}`, { size: 10 });
  if (data.prescriptionNo) draw(`No. Resep: ${data.prescriptionNo}`, { size: 10 });
  draw(`No. Order: #${data.orderId}`, { size: 10 });
  y -= 8;

  draw("Data Pasien", { bold: true, color: green });
  draw(`Nama: ${data.patientName}`);
  draw(`No. RM: ${data.patientRm}`);
  if (data.diagnosis) draw(`Diagnosis: ${data.diagnosis}`);
  y -= 8;

  draw("Metode Pengambilan", { bold: true, color: green });
  draw(decisionLabel(data.patientDecision), { bold: true });
  if (data.patientDecision === "delivery" && data.deliveryAddress) {
    for (const line of wrapText(`Alamat: ${data.deliveryAddress}`, 85)) {
      draw(line, { size: 10 });
    }
  } else if (data.patientDecision === "pickup") {
    draw("Silakan tunjukkan resi ini kepada petugas apotek saat pengambilan.", { size: 10 });
  }
  y -= 8;

  draw("Daftar Obat (R/)", { bold: true, color: green });
  y -= 4;

  const colDrug = margin;
  const colQty = 300;
  const colPrice = 400;
  const colSub = 480;

  page.drawText("Obat", { x: colDrug, y, size: 9, font: fontBold, color: green });
  page.drawText("Qty", { x: colQty, y, size: 9, font: fontBold, color: green });
  page.drawText("Harga", { x: colPrice, y, size: 9, font: fontBold, color: green });
  page.drawText("Subtotal", { x: colSub, y, size: 9, font: fontBold, color: green });
  y -= lineHeight;

  for (const [index, item] of data.items.entries()) {
    const drugLines = wrapText(`${index + 1}. ${item.drugName}`, 38);
    const qtyText = [item.quantity, item.unit].filter(Boolean).join(" ") || "-";
    const priceText = formatIdr(item.unitPrice);
    const subText = formatIdr(item.subtotal);

    for (let i = 0; i < drugLines.length; i++) {
      if (i === 0) {
        page.drawText(drugLines[i], { x: colDrug, y, size: 10, font });
        page.drawText(qtyText, { x: colQty, y, size: 10, font });
        page.drawText(priceText, { x: colPrice, y, size: 10, font });
        page.drawText(subText, { x: colSub, y, size: 10, font });
      } else {
        page.drawText(drugLines[i], { x: colDrug, y, size: 10, font });
      }
      y -= lineHeight;
      if (y < 120) break;
    }

    if (item.note) {
      for (const line of wrapText(`   ${item.note}`, 80)) {
        page.drawText(line, { x: colDrug, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        y -= lineHeight - 2;
      }
    }
  }

  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 595.28 - margin, y },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 16;
  drawRight(`TOTAL: ${formatIdr(data.totalPrice)}`, { bold: true, size: 12 });
  y -= 10;

  if (data.pharmacistNote) {
    draw("Catatan Apoteker", { bold: true, color: green });
    for (const line of wrapText(data.pharmacistNote, 85)) {
      draw(line, { size: 10 });
    }
    y -= 6;
  }

  y = Math.min(y, 110);
  page.drawText(
    "Resi ini diterbitkan otomatis oleh DARSI Apotek RSI A. Yani setelah konfirmasi pasien.",
    { x: margin, y: 72, size: 8, font, color: rgb(0.45, 0.45, 0.45) }
  );
  page.drawText(
    "Obat hanya dapat diserahkan setelah verifikasi identitas pasien dan resep.",
    { x: margin, y: 58, size: 8, font, color: rgb(0.45, 0.45, 0.45) }
  );

  return doc.save();
}
