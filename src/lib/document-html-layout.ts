/** CSS layar kecil untuk dokumen HTML (resep / ringkasan konsultasi). */
export const DOCUMENT_SCREEN_MOBILE_CSS = `
@media screen and (max-width: 768px) {
  body { background: #fff; overflow-x: hidden; }
  .page {
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 12px 10px;
    min-height: auto;
    box-shadow: none;
  }
  .header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .hospital-brand { align-items: center; }
  .hospital h1 { font-size: 14px; line-height: 1.3; }
  .hospital p { font-size: 10px; word-break: break-word; }
  .doc-meta { text-align: left; }
  .grid-2 { grid-template-columns: 1fr; gap: 8px; }
  .footer {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }
  .verify { max-width: 100%; }
  .signature { min-width: 0; width: 100%; }
  .rx-item { flex-direction: column; gap: 4px; }
}
`;

/** CSS khusus konversi PDF — memaksa layout A4 modern seperti cetak browser. */
export const DOCUMENT_PDF_CSS = `
  body { background: #fff !important; margin: 0; }
  .toolbar { display: none !important; }
  .page {
    width: 210mm;
    min-height: auto;
    margin: 0 auto;
    padding: 14mm 16mm;
    box-shadow: none !important;
    background: #fff;
  }
  .header { display: flex; justify-content: space-between; gap: 16px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
  .verify { max-width: 55%; }
  .signature { text-align: center; min-width: 200px; }
`;

export type DocumentHtmlOptions = {
  /** Sembunyikan toolbar — dipakai saat dokumen dibuka di sheet dalam aplikasi. */
  embed?: boolean;
  /** Layout A4 untuk konversi PDF server. */
  pdf?: boolean;
  /** Logo base64 agar PDF tidak menunggu jaringan. */
  inlineLogoDataUri?: string;
};

export function documentToolbarCss(options?: DocumentHtmlOptions) {
  if (options?.pdf) return DOCUMENT_PDF_CSS;
  if (!options?.embed) return "";
  return `.toolbar { display: none !important; } body { background: #fff; }`;
}

export function documentStandaloneSaveToolbarHtml(): string {
  return `<div class="toolbar">
    <button type="button" class="btn-print" id="darsi-save-pdf">Unduh PDF</button>
  </div>
  <script>
    document.getElementById('darsi-save-pdf')?.addEventListener('click', function() {
      var u = new URL(window.location.href);
      u.searchParams.set('format', 'pdf');
      u.searchParams.set('embed', '1');
      u.searchParams.delete('webview');
      fetch(u.toString(), { credentials: 'include' })
        .then(function(res) {
          if (!res.ok) throw new Error('gagal');
          var name = 'dokumen.pdf';
          var cd = res.headers.get('Content-Disposition');
          if (cd) {
            var m = /filename="?([^";]+)"?/i.exec(cd);
            if (m) name = m[1];
          }
          return res.blob().then(function(blob) {
            var obj = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = obj;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(obj);
          });
        })
        .catch(function() { window.location.href = u.toString(); });
    });
  </script>`;
}
