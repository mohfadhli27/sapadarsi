import { execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
].filter((p): p is string => Boolean(p));

/** Render HTML dokumen klinis ke PDF A4 — layout identik dengan tampilan web/cetak. */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const htmlPath = join(tmpdir(), `darsi-${stamp}.html`);
  const pdfPath = join(tmpdir(), `darsi-${stamp}.pdf`);

  await writeFile(htmlPath, html, "utf8");

  try {
    let lastError: unknown;
    for (const bin of CHROMIUM_CANDIDATES) {
      try {
        await execFileAsync(bin, [
          "--headless=new",
          "--disable-gpu",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-extensions",
          "--virtual-time-budget=10000",
          `--print-to-pdf=${pdfPath}`,
          `file://${htmlPath}`,
        ]);
        return await readFile(pdfPath);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      `Chromium tidak tersedia untuk konversi PDF${lastError instanceof Error ? `: ${lastError.message}` : ""}`
    );
  } finally {
    await Promise.all([
      unlink(htmlPath).catch(() => undefined),
      unlink(pdfPath).catch(() => undefined),
    ]);
  }
}

export function clinicalPdfFilename(kind: "resep" | "ringkasan", documentNo: string) {
  const safe = documentNo.replace(/[^\w.-]+/g, "_");
  return kind === "resep" ? `Resep_${safe}.pdf` : `Ringkasan_${safe}.pdf`;
}
