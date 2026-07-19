"use client";

import { Stethoscope, Clock, Users } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import { parseDoctorDisplayName } from "@/src/lib/doctor-display";

interface DoctorCardProps {
  doctor: RsiDoctorSlot;
  onSelect: (doctor: RsiDoctorSlot) => void;
  disabled?: boolean;
  selected?: boolean;
}

export function DoctorCard({ doctor, onSelect, disabled, selected }: DoctorCardProps) {
  const parsed = parseDoctorDisplayName(doctor.doctorName);
  const initials = parsed.personName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold leading-snug text-foreground">
            {parsed.prefix && <span className="text-primary/90">{parsed.prefix} </span>}
            {parsed.personName}
          </h4>
          {parsed.gelar && (
            <p className="mt-0.5 text-xs font-medium text-primary">{parsed.gelar}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{doctor.unitName}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
          <Stethoscope className="h-3 w-3" />
          {doctor.unitType === "eksekutif" ? "Eksekutif" : "Reguler"}
        </span>
        {doctor.scheduleLabel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Clock className="h-3 w-3" />
            {doctor.scheduleLabel}
          </span>
        )}
        {doctor.quotaRemaining !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            <Users className="h-3 w-3" />
            Kuota: {doctor.quotaRemaining}
          </span>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={disabled}
        onClick={() => onSelect(doctor)}
      >
        Pilih Dokter
      </Button>
    </div>
  );
}
