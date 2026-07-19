"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useAuthStore } from "@/src/stores/auth-store";
import { getConsultationServices } from "@/src/config/consultation-services";
import { isSapabidan } from "@/src/config/app-variant";
import { ROUTES } from "@/src/config/routes";
import { cn } from "@/src/lib/utils";

type HomeDesktopNavProps = {
  onServiceClick: (href: string) => void;
};

export function HomeDesktopNav({ onServiceClick }: HomeDesktopNavProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const consultationServices = getConsultationServices();

  return (
    <nav className="flex items-center gap-0.5" aria-label="Navigasi layanan">
      {consultationServices.map((svc) => (
        <button
          key={svc.id}
          type="button"
          onClick={() => onServiceClick(svc.href)}
          className={cn(
            "rounded-[0.65rem] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
            isSapabidan && "tracking-[-0.01em]"
          )}
        >
          {svc.label.replace("Konsultasi ", "")}
        </button>
      ))}
      {isAuthenticated && (
        <>
          <span className="mx-1 h-4 w-px bg-border/70" aria-hidden />
          <Link
            href={ROUTES.profile}
            className="inline-flex items-center gap-1.5 rounded-[0.65rem] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <User className="h-4 w-4" strokeWidth={2} />
            Profil
          </Link>
        </>
      )}
    </nav>
  );
}
