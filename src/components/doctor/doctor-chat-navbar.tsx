"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { ThemeToggle } from "@/src/components/layout/theme-toggle";
import { useChatStore } from "@/src/stores/chat-store";
import { parseDoctorDisplayName } from "@/src/lib/doctor-display";
import { sessionStatusMeta } from "@/src/lib/session-status";
import { cn } from "@/src/lib/utils";

export function DoctorChatNavbar() {
  const router = useRouter();
  const selectedDoctor = useChatStore((s) => s.selectedDoctor);
  const phase = useChatStore((s) => s.phase);

  const practitionerLine = selectedDoctor?.doctorName
    ? (() => {
        const parsed = parseDoctorDisplayName(selectedDoctor.doctorName);
        const name = `${parsed.prefix ? `${parsed.prefix} ` : ""}${parsed.personName}`.trim();
        return { name, status: sessionStatusMeta(phase) };
      })()
    : null;

  return (
    <nav className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 px-3 backdrop-blur-md">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Kembali"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
        <Stethoscope className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold leading-tight text-foreground">
          Konsultasi Dokter
        </h1>
        {practitionerLine && (
          <p className="flex min-w-0 items-center gap-1 truncate text-[11px] leading-tight">
            <span className="truncate font-medium text-foreground/90">{practitionerLine.name}</span>
            {practitionerLine.status && (
              <>
                <span className="shrink-0 text-muted-foreground/50">·</span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 font-medium",
                    practitionerLine.status.tone
                  )}
                >
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", practitionerLine.status.dot)}
                    aria-hidden
                  />
                  {practitionerLine.status.label}
                </span>
              </>
            )}
          </p>
        )}
      </div>

      <ThemeToggle />
    </nav>
  );
}
