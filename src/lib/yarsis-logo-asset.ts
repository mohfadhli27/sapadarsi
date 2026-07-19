import { access, readFile } from "fs/promises";
import path from "path";
import type { PDFDocument } from "pdf-lib";

const LOGO_FILES = ["yarsis-logo.png", "rsi-logo.png"] as const;

function logoCandidates(): string[] {
  const roots = [
    process.cwd(),
    path.join(process.cwd(), ".."),
    path.join(process.cwd(), "..", ".."),
  ];
  const out: string[] = [];
  for (const root of roots) {
    for (const file of LOGO_FILES) {
      out.push(path.join(root, "public", "logos", file));
    }
  }
  return out;
}

export async function readYarsisLogoPng(): Promise<Buffer | null> {
  for (const filePath of logoCandidates()) {
    try {
      await access(filePath);
      return await readFile(filePath);
    } catch {
      /* try next */
    }
  }
  console.warn("[yarsis-logo] Logo tidak ditemukan di:", logoCandidates().slice(0, 2).join(", "));
  return null;
}

export async function embedYarsisLogoInPdf(doc: PDFDocument) {
  const bytes = await readYarsisLogoPng();
  if (!bytes) return null;
  try {
    return await doc.embedPng(bytes);
  } catch (error) {
    console.warn("[yarsis-logo] embedPng gagal:", error instanceof Error ? error.message : error);
    return null;
  }
}

export function yarsisLogoPublicUrl(baseUrl?: string | null): string {
  const base = (baseUrl?.trim() || "https://sapadarsi.hcm-lab.id").replace(/\/$/, "");
  return `${base}/logos/yarsis-logo.png`;
}
