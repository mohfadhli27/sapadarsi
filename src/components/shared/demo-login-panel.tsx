"use client";

import { useState } from "react";
import { Baby, Pill, Shield, Stethoscope, UserRound, Zap } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  DEMO_ADMINS,
  DEMO_DOCTORS,
  DEMO_MIDWIVES,
  DEMO_PHARMACISTS,
  DEMO_PASSWORD,
  DEMO_PATIENTS,
  isDemoLoginEnabled,
} from "@/src/config/demo-accounts";
import { isSapabidan } from "@/src/config/app-variant";
import { cn } from "@/src/lib/utils";

type DemoLoginPanelProps = {
  onFillAccount: (username: string, password: string) => void;
  selectedUsername?: string;
  className?: string;
};

type DemoSection = "patient" | "doctor" | "midwife" | "pharmacist" | "admin";

export function DemoLoginPanel({
  onFillAccount,
  selectedUsername,
  className,
}: DemoLoginPanelProps) {
  const [section, setSection] = useState<DemoSection>("patient");

  if (!isDemoLoginEnabled()) return null;

  const allSections: { id: DemoSection; label: string }[] = [
    { id: "patient", label: "Pasien" },
    { id: "doctor", label: "Dokter" },
    { id: "midwife", label: "Bidan" },
    { id: "pharmacist", label: "Apotek" },
    { id: "admin", label: "Admin" },
  ];

  const sections = isSapabidan
    ? allSections.filter((s) => s.id === "patient" || s.id === "midwife")
    : allSections;

  const accounts =
    section === "patient"
      ? DEMO_PATIENTS.map((a) => ({
          username: a.username,
          label: a.label,
          subtitle: a.subtitle ?? "",
        }))
      : section === "doctor"
        ? DEMO_DOCTORS
        : section === "midwife"
          ? DEMO_MIDWIVES
          : section === "pharmacist"
            ? DEMO_PHARMACISTS
            : DEMO_ADMINS;

  const SectionIcon =
    section === "patient"
      ? UserRound
      : section === "admin"
        ? Shield
        : section === "midwife"
          ? Baby
          : section === "pharmacist"
            ? Pill
            : Stethoscope;

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-amber-300/60 bg-amber-50/50 p-2.5 sm:p-3 dark:border-amber-800 dark:bg-amber-950/20",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 sm:text-xs">
          Login cepat demo
        </p>
        <span className="ml-auto shrink-0 rounded bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          {DEMO_PASSWORD}
        </span>
      </div>

      <div
        className={cn(
          "mb-2 grid gap-0.5 rounded-lg bg-background/60 p-0.5",
          sections.length === 2 ? "grid-cols-2" : "grid-cols-5"
        )}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "rounded-md py-1 text-[10px] font-medium transition-colors sm:text-[11px]",
              section === s.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="max-h-[220px] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-[280px]">
        {accounts.map((account) => (
          <Button
            key={account.username}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onFillAccount(account.username, DEMO_PASSWORD)}
            className={cn(
              "h-auto min-h-9 w-full justify-start gap-1.5 rounded-lg border-amber-200/80 bg-background/80 px-2 py-1.5 text-left hover:border-amber-400 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950/40 sm:min-h-10 sm:gap-2 sm:px-2.5 sm:py-2",
              selectedUsername === account.username &&
                "border-amber-500 bg-amber-100/80 ring-1 ring-amber-400/50 dark:bg-amber-950/50"
            )}
          >
            <SectionIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium leading-tight">{account.label}</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                {account.username}
              </span>
              {"subtitle" in account && account.subtitle ? (
                <span className="block truncate text-[10px] text-muted-foreground/80">
                  {account.subtitle}
                </span>
              ) : null}
            </span>
          </Button>
        ))}
      </div>

      <p className="mt-1.5 text-center text-[10px] text-muted-foreground sm:mt-2">
        {section === "doctor" && `${DEMO_DOCTORS.length} dokter aktif`}
        {section === "midwife" &&
          (isSapabidan
            ? `${DEMO_MIDWIVES.length} akun bidan demo`
            : `${DEMO_MIDWIVES.length} akun bidan/perawat`)}
        {section === "patient" && (isSapabidan ? "Akun pasien demo Sapabidan" : "Akun pasien demo")}
        {section === "admin" && "Kelola aplikasi & sync dokter RSI"}
        {section === "pharmacist" && "Akun apoteker demo"}
        {" · "}
        password <strong>{DEMO_PASSWORD}</strong>
      </p>
    </div>
  );
}
