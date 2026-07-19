"use client";

import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import { PractitionerCarousel } from "@/src/components/shared/practitioner-carousel";

interface DoctorPickerProps {
  doctors: RsiDoctorSlot[];
  onSelect: (doctor: RsiDoctorSlot) => void;
  loading?: boolean;
  selectedCode?: string;
  subtitle?: string;
}

export function DoctorPicker({ doctors, onSelect, loading, selectedCode, subtitle }: DoctorPickerProps) {
  return (
    <PractitionerCarousel
      title="Pilih Dokter"
      subtitle={
        subtitle ??
        "Direkomendasikan sesuai keluhan Anda · geser untuk lihat lebih banyak"
      }
      practitioners={doctors}
      onSelect={onSelect}
      loading={loading}
      selectedCode={selectedCode}
      selectLabel="Chat"
      variant="doctor"
    />
  );
}
