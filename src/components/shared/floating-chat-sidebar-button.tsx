"use client";

import { Menu } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useChatWorkspace } from "@/src/components/shared/chat-workspace-context";

type FloatingChatSidebarButtonProps = {
  variant: "doctor" | "bidan" | "apoteker";
};

export function FloatingChatSidebarButton({ variant }: FloatingChatSidebarButtonProps) {
  const { openSidebar } = useChatWorkspace();

  return (
    <button
      type="button"
      onClick={openSidebar}
      aria-label="Buka riwayat konsultasi"
      className={cn(
        "fixed left-3 z-30 flex h-11 w-11 items-center justify-center rounded-xl shadow-md backdrop-blur-sm transition-transform active:scale-95 md:hidden",
        "top-[calc(3.5rem+0.625rem)]",
        variant === "bidan"
          ? "border border-pink-200/80 bg-pink-50/95 text-pink-800 dark:border-pink-800/50 dark:bg-pink-950/90 dark:text-pink-100"
          : variant === "apoteker"
            ? "border border-blue-200/80 bg-blue-50/95 text-blue-800 dark:border-blue-800/50 dark:bg-blue-950/90 dark:text-blue-100"
            : "border border-emerald-200/80 bg-emerald-50/95 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/90 dark:text-emerald-100"
      )}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
