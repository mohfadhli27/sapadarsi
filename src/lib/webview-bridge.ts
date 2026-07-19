/** Integrasi unduh dokumen klinis — web browser & SAPADARSI WebView. */

const DOWNLOAD_TIMEOUT_MS = 30_000;

type FlutterDownloadPayload = {
  type: "url";
  url: string;
};

declare global {
  interface Window {
    FlutterDownload?: { postMessage: (message: string) => void };
  }
}

export class ClinicalDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalDownloadError";
  }
}

export function isFlutterWebView(): boolean {
  return typeof window !== "undefined" && typeof window.FlutterDownload !== "undefined";
}

function postDownload(payload: FlutterDownloadPayload) {
  window.FlutterDownload?.postMessage(JSON.stringify(payload));
}

function buildPdfDownloadUrl(relativeOrAbsoluteUrl: string): string {
  const parsed = new URL(relativeOrAbsoluteUrl, window.location.href);
  const isReceipt = parsed.pathname.includes("/receipt");
  parsed.searchParams.set("embed", "1");
  parsed.searchParams.delete("webview");
  if (!isReceipt) {
    parsed.searchParams.set("format", "pdf");
  }
  return parsed.href;
}

function filenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename\*?=(?:UTF-8''|utf-8''|")?([^";]+)/i.exec(disposition);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function waitFlutterDownloadResult(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new ClinicalDownloadError("Unduhan timeout — coba lagi"));
    }, DOWNLOAD_TIMEOUT_MS);

    const onDone = () => {
      cleanup();
      resolve();
    };
    const onFail = () => {
      cleanup();
      reject(new ClinicalDownloadError("Gagal menyimpan dokumen"));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("sapadarsi-download-done", onDone);
      window.removeEventListener("sapadarsi-download-fail", onFail);
    };

    window.addEventListener("sapadarsi-download-done", onDone, { once: true });
    window.addEventListener("sapadarsi-download-fail", onFail, { once: true });
  });
}

/** URL unduh PDF (server mengirim Content-Disposition). */
export function buildClinicalPdfUrl(relativeOrAbsoluteUrl: string): string {
  return buildPdfDownloadUrl(relativeOrAbsoluteUrl);
}

/** Unduh langsung ke penyimpanan HP via Flutter (tanpa preview). */
export async function requestFlutterDownload(relativeOrAbsoluteUrl: string): Promise<void> {
  if (!isFlutterWebView()) {
    throw new ClinicalDownloadError("Bukan SAPADARSI app");
  }
  postDownload({
    type: "url",
    url: buildPdfDownloadUrl(relativeOrAbsoluteUrl),
  });
  await waitFlutterDownloadResult();
}

/**
 * Unduh dokumen langsung — web: file masuk ke folder Download browser;
 * app: disimpan ke folder Download HP via native bridge.
 */
export async function downloadClinicalDocument(relativeOrAbsoluteUrl: string): Promise<void> {
  if (isFlutterWebView()) {
    await requestFlutterDownload(relativeOrAbsoluteUrl);
    return;
  }

  const pdfUrl = buildClinicalPdfUrl(relativeOrAbsoluteUrl);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(pdfUrl, {
      credentials: "include",
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = `Gagal mengunduh (HTTP ${res.status})`;
      try {
        const json = (await res.json()) as { message?: string };
        if (json.message) message = json.message;
      } catch {
        /* bukan JSON */
      }
      throw new ClinicalDownloadError(message);
    }

    const contentType = res.headers.get("Content-Type") ?? "";
    if (!contentType.includes("pdf")) {
      throw new ClinicalDownloadError("Server tidak mengembalikan PDF");
    }

    const blob = await res.blob();
    const filename = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? "dokumen.pdf";
    triggerBrowserDownload(blob, filename);
  } catch (error) {
    if (error instanceof ClinicalDownloadError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ClinicalDownloadError("Unduhan timeout — coba lagi");
    }
    throw new ClinicalDownloadError("Gagal mengunduh dokumen");
  } finally {
    window.clearTimeout(timer);
  }
}
