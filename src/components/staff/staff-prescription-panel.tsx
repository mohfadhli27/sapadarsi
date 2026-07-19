"use client";

import { useState } from "react";
import { FileText, Plus, Trash2, Pill } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { emptyMedication } from "@/src/lib/prescription-form";
import type { ConsultationPrescription, PrescriptionMedication } from "@/src/types/prescription";

type StaffPrescriptionPanelProps = {
  sessionId: number;
  patientName?: string | null;
  doctorName?: string | null;
  existing?: ConsultationPrescription | null;
  disabled?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

const inputClass =
  "h-9 rounded-lg border-border/80 bg-muted/30 text-sm shadow-none focus-visible:ring-primary/15";

function defaultValidUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function StaffPrescriptionPanel({
  sessionId,
  patientName,
  doctorName,
  existing,
  disabled,
  onSave,
}: StaffPrescriptionPanelProps) {
  const [open, setOpen] = useState(Boolean(existing));
  const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? "");
  const [icd10, setIcd10] = useState(existing?.icd10 ?? "");
  const [doctorSip, setDoctorSip] = useState(existing?.doctorSip ?? "");
  const [patientWeight, setPatientWeight] = useState(existing?.patientWeight ?? "");
  const [generalAdvice, setGeneralAdvice] = useState(existing?.generalAdvice ?? "");
  const [followUp, setFollowUp] = useState(existing?.followUp ?? "");
  const [validUntil, setValidUntil] = useState(
    existing?.validUntil?.slice(0, 10) ?? defaultValidUntil()
  );
  const [medications, setMedications] = useState<PrescriptionMedication[]>(
    existing?.medications?.length ? existing.medications : [emptyMedication()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateMed(index: number, patch: Partial<PrescriptionMedication>) {
    setMedications((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  async function handleSubmit() {
    setError("");
    setSaving(true);
    try {
      await onSave({
        action: "save_prescription",
        prescription: {
          diagnosis,
          icd10,
          doctorSip,
          patientWeight,
          generalAdvice,
          followUp,
          validUntil,
          medications,
        },
      });
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan resep");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          <div>
            <p className="text-sm font-semibold">Resep Digital</p>
            <p className="text-xs text-muted-foreground">
              {existing
                ? `Terbit: ${existing.prescriptionNo}`
                : "Terbitkan resep untuk pasien unduh di aplikasi"}
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Tutup" : "Buka"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-emerald-200/60 px-4 py-4 dark:border-emerald-900">
          <div className="rounded-xl bg-background/80 px-3 py-2 text-xs text-muted-foreground">
            Pasien: <strong className="text-foreground">{patientName ?? "-"}</strong> · Sesi #
            {sessionId}
            {doctorName ? ` · ${doctorName}` : ""}
          </div>

          {existing && (
            <div className="rounded-xl border border-emerald-300/50 bg-emerald-100/50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              Resep aktif: <strong>{existing.prescriptionNo}</strong> · Berlaku s/d{" "}
              {existing.validUntil.slice(0, 10)} · Kode {existing.verificationCode}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium">Diagnosis *</label>
              <Input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Contoh: ISPA (Infeksi Saluran Pernapasan Akut)"
                className={inputClass}
                disabled={disabled || saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">ICD-10 (opsional)</label>
              <Input
                value={icd10}
                onChange={(e) => setIcd10(e.target.value)}
                placeholder="J06.9"
                className={inputClass}
                disabled={disabled || saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">No. SIP Dokter</label>
              <Input
                value={doctorSip}
                onChange={(e) => setDoctorSip(e.target.value)}
                placeholder="SIP. 123456789"
                className={inputClass}
                disabled={disabled || saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Berat badan pasien</label>
              <Input
                value={patientWeight}
                onChange={(e) => setPatientWeight(e.target.value)}
                placeholder="55 kg"
                className={inputClass}
                disabled={disabled || saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Berlaku s/d *</label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={inputClass}
                disabled={disabled || saving}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Daftar Obat (R/)
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                disabled={disabled || saving}
                onClick={() => setMedications((prev) => [...prev, emptyMedication()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah obat
              </Button>
            </div>

            {medications.map((med, index) => (
              <div key={index} className="rounded-xl border bg-background/90 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    R/ Obat {index + 1}
                  </span>
                  {medications.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      disabled={disabled || saving}
                      onClick={() => setMedications((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={med.name}
                    onChange={(e) => updateMed(index, { name: e.target.value })}
                    placeholder="Nama obat *"
                    className={inputClass}
                    disabled={disabled || saving}
                  />
                  <Input
                    value={med.strength ?? ""}
                    onChange={(e) => updateMed(index, { strength: e.target.value })}
                    placeholder="Kekuatan (500 mg)"
                    className={inputClass}
                    disabled={disabled || saving}
                  />
                  <Input
                    value={med.dosage}
                    onChange={(e) => updateMed(index, { dosage: e.target.value })}
                    placeholder="Dosis (1 tablet)"
                    className={inputClass}
                    disabled={disabled || saving}
                  />
                  <Input
                    value={med.frequency}
                    onChange={(e) => updateMed(index, { frequency: e.target.value })}
                    placeholder="Frekuensi (3x sehari)"
                    className={inputClass}
                    disabled={disabled || saving}
                  />
                  <Input
                    value={med.route}
                    onChange={(e) => updateMed(index, { route: e.target.value })}
                    placeholder="Rute (Oral)"
                    className={inputClass}
                    disabled={disabled || saving}
                  />
                  <Input
                    value={med.duration}
                    onChange={(e) => updateMed(index, { duration: e.target.value })}
                    placeholder="Durasi (5 hari)"
                    className={inputClass}
                    disabled={disabled || saving}
                  />
                  <Input
                    value={med.quantity ?? ""}
                    onChange={(e) => updateMed(index, { quantity: e.target.value })}
                    placeholder="Jumlah (No. XII)"
                    className={inputClass}
                    disabled={disabled || saving}
                  />
                  <Input
                    value={med.notes ?? ""}
                    onChange={(e) => updateMed(index, { notes: e.target.value })}
                    placeholder="Catatan khusus"
                    className={inputClass}
                    disabled={disabled || saving}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium">Anjuran / edukasi pasien</label>
              <textarea
                value={generalAdvice}
                onChange={(e) => setGeneralAdvice(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm"
                placeholder="Istirahat cukup, perbanyak minum air putih..."
                disabled={disabled || saving}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium">Kontrol ulang</label>
              <Input
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="Kontrol 7 hari lagi bila keluhan berlanjut"
                className={inputClass}
                disabled={disabled || saving}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <Button
            type="button"
            className="h-11 w-full gap-2 rounded-xl"
            disabled={disabled || saving}
            onClick={() => void handleSubmit()}
          >
            <FileText className="h-4 w-4" />
            {saving ? "Menyimpan..." : existing ? "Perbarui & terbitkan resep" : "Terbitkan resep digital"}
          </Button>
        </div>
      )}
    </div>
  );
}
