import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  path.join(process.cwd(), "public/logos/yarsis-logo.png"),
  path.join(process.cwd(), "public/logos/rsi-logo.png"),
];

for (const p of candidates) {
  try {
    const bytes = await readFile(p);
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(bytes);
    console.log("OK", p, img.width, "x", img.height);
  } catch (e) {
    console.log("FAIL", p, e instanceof Error ? e.message : e);
  }
}
