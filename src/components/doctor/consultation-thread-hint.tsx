"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ChatPhase } from "@/src/types/chat";

const STORAGE_PREFIX = "darsi-thread-hint-dismissed";

type ConsultationThreadHintProps = {
  doctorKey: string | null;
  phase: ChatPhase;
};

export function ConsultationThreadHint({ doctorKey, phase }: ConsultationThreadHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!doctorKey || phase === "live" || phase === "closed") {
      setVisible(false);
      return;
    }
    const dismissed = sessionStorage.getItem(`${STORAGE_PREFIX}-${doctorKey}`) === "1";
    setVisible(!dismissed);
  }, [doctorKey, phase]);

  if (!visible) return null;

  function dismiss() {
    if (doctorKey) {
      sessionStorage.setItem(`${STORAGE_PREFIX}-${doctorKey}`, "1");
    }
    setVisible(false);
  }

  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
      <span className="min-w-0 flex-1 leading-snug">
        Riwayat konsultasi per dokter digabung dalam satu percakapan.
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-0.5 hover:bg-muted hover:text-foreground"
        aria-label="Tutup informasi"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
