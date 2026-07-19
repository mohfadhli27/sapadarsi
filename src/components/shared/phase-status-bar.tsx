import { cn } from "@/src/lib/utils";
import { Clock, MessageCircle, X, CheckCircle, Stethoscope } from "lucide-react";
import type { ChatPhase } from "@/src/types/chat";

interface PhaseStatusBarProps {
  phase: ChatPhase;
  doctorName?: string | null;
}

const phaseConfig: Record<
  ChatPhase,
  { label: string; icon: React.ReactNode; color: string }
> = {
  triage: {
    label: "Ceritakan Keluhan Anda",
    icon: <MessageCircle className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/20",
  },
  selecting_doctor: {
    label: "Pilih Dokter",
    icon: <Stethoscope className="h-4 w-4" />,
    color: "bg-primary/10 text-primary border-primary/20",
  },
  selecting_practitioner: {
    label: "Pilih Bidan / Perawat",
    icon: <Stethoscope className="h-4 w-4" />,
    color: "bg-pink-500/10 text-pink-700 border-pink-500/20 dark:text-pink-400",
  },
  waiting: {
    label: "Dokter Meninjau Permintaan",
    icon: <Clock className="h-4 w-4" />,
    color: "bg-warning/15 text-warning-foreground border-warning/30",
  },
  live: {
    label: "Konsultasi Dokter",
    icon: <Stethoscope className="h-4 w-4" />,
    color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  },
  rejected: {
    label: "Ditolak",
    icon: <X className="h-4 w-4" />,
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
  closed: {
    label: "Konsultasi Selesai",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "bg-muted text-muted-foreground border-border",
  },
};

export function PhaseStatusBar({ phase, doctorName }: PhaseStatusBarProps) {
  if (phase === "live" || phase === "closed") {
    return null;
  }

  const config = phaseConfig[phase];
  const label =
    phase === "waiting" && doctorName
      ? `Menunggu ${doctorName}`
      : config.label;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 border-b px-3 py-1.5 text-[11px] font-medium",
        config.color
      )}
    >
      {config.icon}
      <span className="truncate">{label}</span>
    </div>
  );
}
