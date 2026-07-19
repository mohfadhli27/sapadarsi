"use client";

import { useState } from "react";
import { Download, FileText, Store, Truck } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { downloadClinicalDocument, ClinicalDownloadError } from "@/src/lib/webview-bridge";
import type { PharmacyReceiptMeta } from "@/src/types/pharmacy-receipt";

const YARSIS_LOGO = "/logos/yarsis-logo.png";

type Props = {
  receipt: PharmacyReceiptMeta;
  sessionId: number;
  patientId?: number;
};

export function PharmacyReceiptCard({ receipt, sessionId, patientId }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadUrl =
    patientId != null
      ? `/api/pharmacy/sessions/${sessionId}/prescription-orders/${receipt.orderId}/receipt?patientId=${patientId}`
      : null;

  const totalLabel =
    receipt.totalPrice != null
      ? new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(receipt.totalPrice)
      : null;

  const DecisionIcon = receipt.decision === "delivery" ? Truck : Store;
  const decisionLabel =
    receipt.decision === "delivery" ? "Pengantaran ke alamat" : "Ambil di apotek";

  async function handleDownload() {
    if (!downloadUrl || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadClinicalDocument(downloadUrl);
    } catch (error) {
      setDownloadError(
        error instanceof ClinicalDownloadError ? error.message : "Gagal mengunduh dokumen"
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-4 my-3 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-background shadow-sm dark:border-blue-900 dark:from-blue-950/30">
      <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-600/10 px-4 py-3 dark:border-blue-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={YARSIS_LOGO}
          alt="Yarsis"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Resi Pemesanan Obat
          </p>
          <p className="truncate text-xs text-muted-foreground">{receipt.receiptNo}</p>
        </div>
        <DecisionIcon className="h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
      </div>

      <div className="space-y-3 p-4 text-sm">
        <div className="flex items-center gap-2 rounded-lg border border-blue-200/60 bg-background/80 px-3 py-2 text-xs dark:border-blue-900">
          <DecisionIcon className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            Metode: <strong>{decisionLabel}</strong>
            {totalLabel ? (
              <>
                {" · "}Total: <strong>{totalLabel}</strong>
              </>
            ) : null}
          </span>
        </div>

        <Button
          type="button"
          className="h-11 w-full gap-2 rounded-xl bg-blue-700 hover:bg-blue-800"
          disabled={!downloadUrl || downloading}
          onClick={() => void handleDownload()}
        >
          <Download className="h-4 w-4" />
          {downloading ? "Mengunduh..." : "Unduh Resi"}
        </Button>

        {downloadError ? (
          <p className="text-xs text-destructive">{downloadError}</p>
        ) : null}

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Resi berisi daftar obat sesuai resep dan total biaya. Tunjukkan saat pengambilan atau
          saat kurir apotek mengantar obat.
        </p>
      </div>
    </div>
  );
}
