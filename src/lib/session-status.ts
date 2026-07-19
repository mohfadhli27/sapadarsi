import type { ChatPhase } from "@/src/types/chat";

export function sessionStatusMeta(phase: ChatPhase) {
  switch (phase) {
    case "waiting":
      return {
        label: "Menunggu disetujui",
        dot: "bg-amber-500",
        tone: "text-amber-700 dark:text-amber-300",
      };
    case "live":
      return {
        label: "Aktif",
        dot: "bg-emerald-500 animate-pulse",
        tone: "text-emerald-700 dark:text-emerald-300",
      };
    case "closed":
      return {
        label: "Selesai",
        dot: "bg-muted-foreground/50",
        tone: "text-muted-foreground",
      };
    case "rejected":
      return {
        label: "Ditolak",
        dot: "bg-destructive",
        tone: "text-destructive",
      };
    default:
      return null;
  }
}
