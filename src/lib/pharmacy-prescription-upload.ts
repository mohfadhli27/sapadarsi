import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export function getPharmacyUploadDir() {
  return (
    process.env.PHARMACY_PRESCRIPTION_UPLOAD_DIR?.trim() ||
    path.join(process.cwd(), ".tmp", "pharmacy-prescriptions")
  );
}

export function getMaxPharmacyUploadBytes() {
  const mb = Number(process.env.PHARMACY_PRESCRIPTION_MAX_SIZE_MB || "10");
  return Math.max(1, mb) * 1024 * 1024;
}

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
}

export function getPharmacyReceiptUploadDir() {
  return path.join(getPharmacyUploadDir(), "receipts");
}

export async function savePharmacyReceiptPdf(input: {
  buffer: Buffer;
  patientId: number;
  orderId: number;
  receiptNo: string;
}) {
  if (!isPdfBuffer(input.buffer)) {
    throw new Error("File bukan PDF valid");
  }

  const uploadDir = getPharmacyReceiptUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const safeName = `receipt-${input.patientId}-${input.orderId}-${randomBytes(12).toString("hex")}.pdf`;
  const absolutePath = path.join(uploadDir, safeName);
  await writeFile(absolutePath, input.buffer);

  return {
    storedPath: absolutePath,
    storedFileName: safeName,
    mimeType: "application/pdf",
    sizeBytes: input.buffer.length,
    displayName: `${input.receiptNo}.pdf`,
  };
}

export async function savePharmacyPdfFile(input: {
  buffer: Buffer;
  originalName: string;
  patientId: number;
  orderId: number;
}) {
  if (!isPdfBuffer(input.buffer)) {
    throw new Error("File bukan PDF valid");
  }
  if (input.buffer.length > getMaxPharmacyUploadBytes()) {
    throw new Error("Ukuran file melebihi batas");
  }

  const uploadDir = getPharmacyUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const safeName = `${input.patientId}-${input.orderId}-${randomBytes(16).toString("hex")}.pdf`;
  const absolutePath = path.join(uploadDir, safeName);
  await writeFile(absolutePath, input.buffer);

  return {
    storedPath: absolutePath,
    storedFileName: safeName,
    mimeType: "application/pdf",
    sizeBytes: input.buffer.length,
    displayName: input.originalName.slice(0, 200),
  };
}
