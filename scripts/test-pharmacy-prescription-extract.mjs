#!/usr/bin/env node
/**
 * Uji ekstraksi resep dari PDF upload apoteker.
 * Jalankan: node scripts/test-pharmacy-prescription-extract.mjs [path-to.pdf]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function extractText(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

function parsePrescriptionTextToItems(text) {
  const PDF_JUNK = new Set(["FlateDecode", "Filter", "Length", "Adobe"]);
  const looksLikeDrugName = (name) => {
    if (!name || name.length < 2) return false;
    if (PDF_JUNK.has(name)) return false;
    if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(name)) return false;
    return true;
  };

  const normalized = text.replace(/\r\n/g, "\n");
  const items = [];
  const blocks = normalized.split(/(?:^|\n)\s*R\s*\/\s*(?=\d+\.\s)/im).slice(1);

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^(KONTROL|Verifikasi|DARSI)/i.test(l));
    if (!lines.length) continue;
    const drugName = lines[0].replace(/^\d+\.\s*/, "").trim();
    if (!looksLikeDrugName(drugName)) continue;

    let quantity = "1";
    let unit = "unit";
    const notes = [];
    for (const line of lines.slice(1)) {
      const no = line.match(/^No\.?\s*(.+)$/i);
      if (no) {
        const m = no[1].trim().match(/^(\d+)/);
        if (m) quantity = m[1];
        continue;
      }
      if (/^S\.?\s*/i.test(line)) notes.push(line);
      if (/^catatan:/i.test(line)) notes.push(line);
    }
    items.push({ drugName, quantity, unit, note: notes.join(" · ") });
  }
  return items;
}

const pdfPath =
  process.argv[2] ||
  path.join(__dirname, "../.tmp/pharmacy-prescriptions/2-2-6d44f459f77774469fbf7e7d87958d3f.pdf");

if (!fs.existsSync(pdfPath)) {
  console.error("PDF tidak ditemukan:", pdfPath);
  process.exit(1);
}

const text = await extractText(pdfPath);
console.log("--- TEKS RESEP (500 char) ---");
console.log(text.slice(0, 800));
console.log("\n--- ITEM TERPARSING ---");
const items = parsePrescriptionTextToItems(text);
for (const item of items) {
  console.log(`• ${item.drugName} | qty ${item.quantity} ${item.unit} | ${item.note || ""}`);
}
if (items.length === 0) {
  console.error("FAIL: tidak ada item");
  process.exit(1);
}
if (items.some((i) => /FlateDecode|Decode/i.test(i.drugName))) {
  console.error("FAIL: masih ada metadata PDF");
  process.exit(1);
}
console.log("\nOK", items.length, "item");
