"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Pill } from "lucide-react";
import { ThemeToggle } from "@/src/components/layout/theme-toggle";

export function PharmacyChatNavbar() {
  const router = useRouter();

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

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
        <Pill className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold leading-tight text-foreground">
          Konsultasi Apoteker
        </h1>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">
          Tanya obat, dosis, dan interaksi
        </p>
      </div>

      <ThemeToggle />
    </nav>
  );
}
