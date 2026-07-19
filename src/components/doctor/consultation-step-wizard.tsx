"use client";

import { cn } from "@/src/lib/utils";
import { Check } from "lucide-react";
import type { ChatPhase } from "@/src/types/chat";

const STEPS: { phase: ChatPhase[]; label: string; num: number }[] = [
  { phase: ["triage"], label: "Keluhan", num: 1 },
  { phase: ["selecting_doctor"], label: "Pilih Dokter", num: 2 },
  { phase: ["waiting"], label: "Konfirmasi", num: 3 },
  { phase: ["live"], label: "Konsultasi", num: 4 },
  { phase: ["closed", "rejected"], label: "Selesai", num: 5 },
];

function stepIndex(phase: ChatPhase) {
  if (phase === "closed" || phase === "rejected") return 4;
  const idx = STEPS.findIndex((s) => s.phase.includes(phase));
  return idx >= 0 ? idx : 0;
}

export function ConsultationStepWizard({ phase }: { phase: ChatPhase }) {
  const current = stepIndex(phase);

  return (
    <div className="border-b bg-card px-3 py-3 sm:px-4">
      <ol className="mx-auto flex max-w-lg items-center justify-between gap-1">
        {STEPS.slice(0, 4).map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && !done && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !done && !active && "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : step.num}
              </div>
              <span
                className={cn(
                  "hidden text-center text-[10px] font-medium sm:block",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
