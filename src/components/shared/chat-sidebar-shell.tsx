"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

type ChatSidebarShellProps = {
  onNew: () => void;
  newLabel?: string;
  searchPlaceholder?: string;
  query: string;
  onQueryChange: (q: string) => void;
  recentLabel?: string;
  children: React.ReactNode;
};

export function ChatSidebarShell({
  onNew,
  newLabel = "Konsultasi baru",
  searchPlaceholder = "Cari...",
  query,
  onQueryChange,
  recentLabel = "Terkini",
  children,
}: ChatSidebarShellProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="flex flex-col gap-2 border-b p-3">
        <Button
          type="button"
          variant="outline"
          onClick={onNew}
          className="h-10 w-full justify-start gap-2 rounded-xl border-dashed px-3"
          aria-label={newLabel}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="truncate">{newLabel}</span>
        </Button>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
      </div>

      <div className="px-3 pt-2.5">
        <p className="text-[11px] font-medium text-muted-foreground">{recentLabel}</p>
      </div>

      <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {children}
      </div>
    </aside>
  );
}

type ChatSidebarThreadButtonProps = {
  selected: boolean;
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  preview?: string;
  meta?: string;
  iconClassName?: string;
};

export function ChatSidebarThreadButton({
  selected,
  active,
  onClick,
  icon,
  title,
  subtitle,
  preview,
  meta,
  iconClassName,
}: ChatSidebarThreadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-xl px-3 py-3 text-left transition-colors",
        selected ? "bg-primary/10 ring-1 ring-primary/25" : "hover:bg-muted/50"
      )}
    >
      <div
        className={cn(
          "relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          iconClassName ??
            (selected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground")
        )}
      >
        {icon}
        {active && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{title}</p>
          {active && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          )}
        </div>
        {subtitle && (
          <p className="truncate text-[11px] text-primary/80">{subtitle}</p>
        )}
        {preview && (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {preview}
          </p>
        )}
        {meta && (
          <p className="mt-1 text-[10px] text-muted-foreground">{meta}</p>
        )}
      </div>
    </button>
  );
}
