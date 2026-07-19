/** Bersihkan label internal & rapikan Markdown jawaban apoteker untuk pasien. */

const LEAK_PATTERNS: RegExp[] = [
  /\[INTERNAL[^\]]*\]/gi,
  /\[WARNING\]/gi,
  /\[INFO\]/gi,
  /\[HIGH\]/gi,
  /Hasil Pemeriksaan Interaksi[^\n]*/gi,
  /Level\s*3/gi,
  /KONTEKS DATABASE[^\n]*/gi,
  /Berdasarkan Hasil Pemeriksaan[^\n]*/gi,
  /per e-Fornas RSI/gi,
  /\(Level \d+\)/gi,
  /DATA INTERNAL[^\n]*/gi,
  /JANGAN TAMPILKAN KE PASIEN[^\n]*/gi,
  /BRIEF FARMASI MEDGEMMA[^\n]*/gi,
  /^RINGKASAN:\s*.+$/gim,
  /^MEKANISME:\s*.+$/gim,
  /^KEAMANAN:\s*.+$/gim,
  /^CATATAN FARMASI:\s*.+$/gim,
  /^ESKALASI DOKTER:\s*.+$/gim,
  /\bNemotron\b/gi,
  /\bMedGemma\b/gi,
];

export function sanitizePharmacyResponse(text: string): string {
  let out = text;
  for (const pattern of LEAK_PATTERNS) {
    out = out.replace(pattern, "");
  }

  out = out
    .replace(/\bBooleh\b/gi, "Boleh")
    .replace(/\blontano\b/gi, "jauh")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalizePharmacyMarkdown(out);
}

export function normalizePharmacyMarkdown(text: string): string {
  let out = text;

  // Kartu obat: --- Obat N: NAMA --- → heading
  out = out.replace(
    /^---\s*Obat\s*(\d+):\s*(.+?)\s*---$/gim,
    "### Obat $1: $2"
  );
  out = out.replace(/^---\s*Obat:\s*(.+?)\s*---$/gim, "### $1");

  // Bullet • → markdown list -
  out = out.replace(/^•\s+/gm, "- ");

  // Emoji section tanpa ### → tambahkan heading
  out = out.replace(
    /(^|\n\n)(💊\s*)([^\n#]+)(\n)/g,
    (_, before, _emoji, title, after) => `${before}### 💊 ${title.trim()}${after}`
  );
  out = out.replace(
    /(^|\n\n)(🔄\s*)([^\n#]+)(\n)/g,
    (_, before, _emoji, title, after) => `${before}### 🔄 ${title.trim()}${after}`
  );
  out = out.replace(
    /(^|\n\n)(⚠️\s*)([^\n#]+)(\n)/g,
    (_, before, _emoji, title, after) =>
      `${before}### ⚠️ ${title.trim().replace(/^Yang perlu diperhatikan$/i, "Yang perlu diperhatikan")}${after}`
  );

  // Heading menempel teks sebelumnya
  out = out.replace(/([^\n])\s*(#{1,4}\s)/g, "$1\n\n$2");
  out = out.replace(/(#{1,4}[^\n]+)\s*(-\s+\*\*)/g, "$1\n\n$2");

  // Pastikan baris kosong setelah heading
  out = out.replace(/(#{1,4}[^\n]+)\n(?!\n)/g, "$1\n\n");

  // Bullet tanpa line break
  out = out.replace(/([^\n])\n(-\s+\*\*)/g, "$1\n\n$2");

  // Section Interaksi
  out = out.replace(
    /(^|\n\n)\*\*Interaksi\*\*(\n)/g,
    "$1### Interaksi$2"
  );

  out = out.replace(
    /###\s*⚠️\s*Perhatian\s*Penting/gi,
    "### ⚠️ Yang perlu diperhatikan"
  );
  out = out.replace(
    /###\s*⚠️\s*Perhatian(?!\s*Penting)/gi,
    "### ⚠️ Yang perlu diperhatikan"
  );

  return out.replace(/\n{3,}/g, "\n\n").trim();
}
