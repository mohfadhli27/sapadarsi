"use client";

import { useState } from "react";
import { Check, MessageCircle, X } from "lucide-react";
import { Button } from "@/src/components/ui/button";

type StaffApprovalActionsProps = {
  disabled?: boolean;
  onApprove: () => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  showTelegramHint?: boolean;
};

export function StaffApprovalActions({
  disabled,
  onApprove,
  onReject,
  showTelegramHint = true,
}: StaffApprovalActionsProps) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function handleApprove() {
    setLoading("approve");
    try {
      await onApprove();
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    setLoading("reject");
    try {
      await onReject(rejectReason.trim() || undefined);
      setShowRejectForm(false);
      setRejectReason("");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 dark:border-amber-900 dark:from-amber-950/40 dark:to-orange-950/20">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Menunggu persetujuan Anda
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
            Pasien menunggu konfirmasi untuk memulai konsultasi live. Setujui atau tolak di sini,
            atau lewat notifikasi Telegram jika tersedia.
          </p>
        </div>
      </div>

      {!showRejectForm ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-9 flex-1 gap-1.5 sm:flex-none"
            disabled={disabled || loading !== null}
            onClick={() => void handleApprove()}
          >
            <Check className="h-4 w-4" />
            {loading === "approve" ? "Menyetujui..." : "Setujui"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 flex-1 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5 sm:flex-none"
            disabled={disabled || loading !== null}
            onClick={() => setShowRejectForm(true)}
          >
            <X className="h-4 w-4" />
            Tolak
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Alasan penolakan (opsional)..."
            className="w-full resize-none rounded-xl border border-border/80 bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-9"
              disabled={disabled || loading !== null}
              onClick={() => void handleReject()}
            >
              {loading === "reject" ? "Menolak..." : "Konfirmasi tolak"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              disabled={loading !== null}
              onClick={() => {
                setShowRejectForm(false);
                setRejectReason("");
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {showTelegramHint && (
        <p className="mt-3 text-[11px] leading-relaxed text-amber-800/70 dark:text-amber-300/70">
          Alternatif: balas via bot Telegram dengan tombol Setujui / Tolak pada grup approval.
        </p>
      )}
    </div>
  );
}
