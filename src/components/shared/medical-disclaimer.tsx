"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const STORAGE_KEY = "darsi-medical-disclaimer-dismissed";

export function MedicalDisclaimer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(sessionStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="shrink-0 border-b border-warning/25 bg-warning/10 px-3 py-1.5">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-foreground" />
        <p className="min-w-0 flex-1 text-[10px] leading-snug text-warning-foreground sm:text-[11px]">
          <span className="font-semibold">Penting:</span> DARSI adalah analisis awal
          berbasis AI, <span className="font-bold">bukan diagnosis medis</span>. Konsultasikan
          tenaga medis untuk penanganan lanjut.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded p-0.5 text-warning-foreground/80 hover:bg-warning/20 hover:text-warning-foreground"
          aria-label="Tutup peringatan"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
