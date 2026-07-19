"use client";

import { useState } from "react";
import { CheckCircle, Download, FileText, Stethoscope, Calendar, Building2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { downloadClinicalDocument, ClinicalDownloadError } from "@/src/lib/webview-bridge";

const HOSPITAL = {
  name: "YAYASAN RUMAH SAKIT ISLAM A. YANI",
  address: "Jl. Mayjen Sungkono No. 119, Surabaya 60189",
};

export type SessionSummaryCard = {
  doctorName?: string | null;
  unitName?: string | null;
  scheduleDate?: string | null;
  complaint?: string | null;
  advice?: string;
  completedAt?: string;
  summaryText?: string;
  keyFindings?: string[];
  diagnosis?: string;
  followUp?: string;
};

interface ConsultationSummaryCardProps {
  summary: SessionSummaryCard;
  providerLabel?: string;
  sessionId?: number | null;
  patientId?: number | null;
  downloadUrl?: string | null;
}

export function ConsultationSummaryCard({
  summary,
  providerLabel = "Dokter",
  downloadUrl,
}: ConsultationSummaryCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
    <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-primary/20 shadow-sm">
      <div className="border-b border-primary/10 bg-gradient-to-r from-emerald-700 to-emerald-600 px-4 py-3 text-white">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 opacity-90" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">{HOSPITAL.name}</p>
            <p className="text-[10px] leading-snug opacity-90">{HOSPITAL.address}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-white/20 pt-2">
          <CheckCircle className="h-4 w-4" />
          <span className="text-xs font-medium tracking-wide">RINGKASAN HASIL KONSULTASI</span>
        </div>
      </div>
      <div className="space-y-3 bg-gradient-to-br from-emerald-50/50 to-background p-4 text-sm dark:from-emerald-950/20">
        {summary.doctorName && (
          <div className="flex items-start gap-2">
            <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{providerLabel}</p>
              <p className="font-medium">{summary.doctorName}</p>
              {summary.unitName && (
                <p className="text-xs text-muted-foreground">{summary.unitName}</p>
              )}
            </div>
          </div>
        )}
        {summary.scheduleDate && (
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Tanggal</p>
              <p className="font-medium">{summary.scheduleDate}</p>
            </div>
          </div>
        )}
        {summary.complaint && (
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Keluhan</p>
              <p>{summary.complaint}</p>
            </div>
          </div>
        )}
        {summary.summaryText && (
          <div className="rounded-lg border border-primary/10 bg-background/80 px-3 py-2.5">
            <p className="mb-1 text-xs font-medium text-primary">Ringkasan Hasil</p>
            <p className="text-xs leading-relaxed text-foreground">{summary.summaryText}</p>
          </div>
        )}
        {summary.keyFindings && summary.keyFindings.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Temuan Utama</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-foreground">
              {summary.keyFindings.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.diagnosis && (
          <div>
            <p className="text-xs text-muted-foreground">Diagnosis</p>
            <p className="font-medium">{summary.diagnosis}</p>
          </div>
        )}
        {summary.advice && (
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Anjuran: </span>
            {summary.advice}
          </div>
        )}
        {summary.followUp && (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Kontrol ulang: </span>
            {summary.followUp}
          </div>
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
          File PDF otomatis tersimpan — tanpa preview cetak.
        </p>
      </div>
    </div>
  );
}
