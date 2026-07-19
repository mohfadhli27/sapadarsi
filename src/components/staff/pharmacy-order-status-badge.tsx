"use client";

import { cn } from "@/src/lib/utils";
import type { PharmacyOrderStatus } from "@/src/types/pharmacy-order";

export const STATUS_LABEL: Record<string, string> = {
  prescription_uploaded: "Resep diupload",
  waiting_pharmacist_review: "Menunggu review",
  preparing_medicine: "Menyiapkan obat",
  medicine_ready_waiting_patient_decision: "Menunggu keputusan",
  delivery_requested: "Antar ke alamat",
  pickup_selected: "Ambil di apotek",
  canceled_by_patient: "Dibatalkan",
  completed: "Selesai",
};

const STATUS_TONE: Partial<Record<PharmacyOrderStatus, string>> = {
  prescription_uploaded: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  waiting_pharmacist_review: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  preparing_medicine: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  medicine_ready_waiting_patient_decision:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  delivery_requested: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  pickup_selected: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  canceled_by_patient: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

type Props = {
  status: PharmacyOrderStatus | string;
  className?: string;
  size?: "sm" | "md";
};

export function PharmacyOrderStatusBadge({ status, className, size = "sm" }: Props) {
  const label = STATUS_LABEL[status] ?? status;
  const tone =
    STATUS_TONE[status as PharmacyOrderStatus] ??
    "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px] md:text-xs" : "px-3 py-1 text-xs",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}
