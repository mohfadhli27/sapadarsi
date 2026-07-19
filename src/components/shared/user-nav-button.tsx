"use client";

import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { useAuthStore } from "@/src/stores/auth-store";
import { ROUTES } from "@/src/config/routes";
import { cn } from "@/src/lib/utils";

interface UserNavButtonProps {
  className?: string;
  /** Tampilan ringkas untuk header mobile */
  compact?: boolean;
}

export function UserNavButton({ className, compact = false }: UserNavButtonProps) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  if (!user) return null;

  const initial = user.name.charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => router.push(ROUTES.profile)}
      className={cn(
        "flex items-center gap-2 rounded-full border border-border/60 bg-card transition-colors hover:bg-accent/60",
        compact ? "h-9 py-0 pl-0.5 pr-2.5" : "py-1 pl-1 pr-3",
        className
      )}
      aria-label={`Profil ${user.name}`}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white",
          compact ? "h-8 w-8 text-xs" : "h-8 w-8 text-sm"
        )}
      >
        {initial}
      </span>
      {!compact && (
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-foreground sm:inline">
          Profil
        </span>
      )}
      {compact ? (
        <span className="max-w-[72px] truncate text-xs font-medium text-foreground">
          Profil
        </span>
      ) : (
        <User className="h-4 w-4 text-muted-foreground sm:hidden" />
      )}
    </button>
  );
}
