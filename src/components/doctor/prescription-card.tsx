"use client";

import { useState } from "react";
import { Download, FileText, Pill, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { downloadClinicalDocument, ClinicalDownloadError } from "@/src/lib/webview-bridge";
import { isSapabidan } from "@/src/config/app-variant";
import type { ConsultationPrescription } from "@/src/types/prescription";

const YARSIS_LOGO = "/logos/yarsis-logo.png";

type PrescriptionCardProps = {
  prescription: ConsultationPrescription;
  patientId?: number;
};

export function PrescriptionCard({ prescription, patientId }: PrescriptionCardProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadUrl =
    patientId && prescription.sessionId
      ? `/api/consultations/${prescription.sessionId}/prescription?patientId=${patientId}`
      : null;

  async function handleSendToPharmacy() {
    if (!patientId || !prescription.sessionId) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/pharmacy/prescription-orders/from-darsi-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          sourceConsultationSessionId: prescription.sessionId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Gagal mengirim resep");
      const target = data.redirectUrl as string | undefined;
      if (target && typeof window !== "undefined" && target !== window.location.origin + data.redirectPath) {
        window.location.href = target;
        return;
      }
      router.push(data.redirectPath ?? "/chat/apoteker");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Gagal mengirim resep");
    } finally {
      setSending(false);
    }
  }

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
    <div className="mx-4 my-3 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-background shadow-sm dark:border-emerald-900 dark:from-emerald-950/30">
      <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-600/10 px-4 py-3 dark:border-emerald-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={YARSIS_LOGO}
          alt="Yarsis"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            Resep Digital Diterbitkan
          </p>
          <p className="truncate text-xs text-muted-foreground">{prescription.prescriptionNo}</p>
        </div>
        <Pill className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
      </div>

      <div className="space-y-3 p-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Diagnosis</p>
          <p className="font-medium">{prescription.diagnosis}</p>
          {prescription.icd10 && (
            <p className="text-xs text-muted-foreground">ICD-10: {prescription.icd10}</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            Obat ({prescription.medications.length})
          </p>
          <ul className="space-y-1.5">
            {prescription.medications.map((med, i) => (
              <li key={i} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                <span className="font-semibold">
                  R/ {med.name}
                  {med.strength ? ` ${med.strength}` : ""}
                </span>
                <p className="mt-0.5 text-muted-foreground">
                  {med.dosage}, {med.frequency}, {med.route} · {med.duration}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-background/80 px-3 py-2 text-xs dark:border-emerald-900">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Kode verifikasi: <strong className="font-mono">{prescription.verificationCode}</strong>
            {" · "}Berlaku s/d {prescription.validUntil.slice(0, 10)}
          </span>
        </div>

        {!isSapabidan && (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2 rounded-xl border-blue-300 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-200"
              disabled={!patientId || sending}
              onClick={() => void handleSendToPharmacy()}
            >
              <Send className="h-4 w-4" />
              {sending ? "Mengirim..." : "Kirim ke Apotek"}
            </Button>

            {sendError && <p className="text-xs text-destructive">{sendError}</p>}
          </>
        )}

        <Button
          type="button"
          className="h-11 w-full gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800"
          disabled={!downloadUrl || downloading}
          onClick={() => void handleDownload()}
        >
          <Download className="h-4 w-4" />
          {downloading ? "Mengunduh..." : "Unduh Dokumen"}
        </Button>

        {downloadError ? (
          <p className="text-xs text-destructive">{downloadError}</p>
        ) : null}

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          File PDF otomatis tersimpan — tanpa preview cetak. Resep dapat ditukar di Apotek RSI A. Yani
          dengan membawa identitas diri dan kode verifikasi di atas.
        </p>
      </div>
    </div>
  );
}
