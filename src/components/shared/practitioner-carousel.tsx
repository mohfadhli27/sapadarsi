"use client";

import { ChevronRight, Clock, Star, Stethoscope, Users } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import { parseDoctorDisplayName } from "@/src/lib/doctor-display";
import { practitionerDisplayStats } from "@/src/lib/practitioner-stats";

export type PractitionerCarouselProps = {
  title: string;
  subtitle?: string;
  practitioners: RsiDoctorSlot[];
  onSelect: (item: RsiDoctorSlot) => void;
  loading?: boolean;
  selectedCode?: string;
  selectLabel?: string;
  variant?: "doctor" | "bidan";
};

function PractitionerCard({
  item,
  onSelect,
  disabled,
  selected,
  selectLabel,
  variant,
}: {
  item: RsiDoctorSlot;
  onSelect: (item: RsiDoctorSlot) => void;
  disabled?: boolean;
  selected?: boolean;
  selectLabel: string;
  variant: "doctor" | "bidan";
}) {
  const parsed = parseDoctorDisplayName(item.doctorName);
  const initials = parsed.personName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const stats = practitionerDisplayStats(item.doctorCode);
  const specialty = parsed.gelar || item.unitName;

  return (
    <div
      className={cn(
        "flex w-[min(280px,78vw)] shrink-0 snap-start flex-col rounded-2xl border bg-card p-4 shadow-sm transition-all",
        selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-lg font-bold",
            variant === "bidan" ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300" : "bg-primary/10 text-primary"
          )}
        >
          {initials || "RS"}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
            {parsed.prefix && <span className="text-primary/90">{parsed.prefix} </span>}
            {parsed.personName}
          </h4>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{specialty}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
          <Clock className="h-3 w-3" />
          {stats.years} th
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {stats.rating}%
        </span>
        {item.quotaRemaining !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            <Users className="h-3 w-3" />
            Slot {item.quotaRemaining}
          </span>
        )}
        {item.scheduleLabel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Stethoscope className="h-3 w-3" />
            {item.scheduleLabel}
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        Konsultasi DARSI · Gratis
      </p>

      <Button
        type="button"
        size="sm"
        className={cn(
          "mt-3 w-full rounded-xl font-semibold",
          variant === "bidan" && "bg-pink-600 hover:bg-pink-700"
        )}
        disabled={disabled}
        onClick={() => onSelect(item)}
      >
        {selectLabel}
      </Button>
    </div>
  );
}

export function PractitionerCarousel({
  title,
  subtitle,
  practitioners,
  onSelect,
  loading,
  selectedCode,
  selectLabel = "Chat",
  variant = "doctor",
}: PractitionerCarouselProps) {
  if (loading) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        Memuat daftar {variant === "bidan" ? "bidan/perawat" : "dokter"}...
      </div>
    );
  }

  if (practitioners.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada {variant === "bidan" ? "bidan/perawat" : "dokter"} tersedia saat ini.
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-2">
      <div className="px-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="relative">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-thin">
          {practitioners.map((item) => (
            <PractitionerCard
              key={`${item.doctorCode}-${item.unitId}`}
              item={item}
              onSelect={onSelect}
              selected={selectedCode === `${item.doctorCode}:${item.unitId}`}
              selectLabel={selectLabel}
              variant={variant}
            />
          ))}
        </div>
        {practitioners.length > 1 && (
          <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full border bg-background/90 p-1 shadow-sm sm:flex">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
