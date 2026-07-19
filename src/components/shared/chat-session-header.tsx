"use client";

type ChatSessionHeaderProps = {
  title?: string | null;
  subtitle?: string | null;
  live?: boolean;
};

/** Header sesi aktif — hanya dokter/bidan terpilih, bukan nama layanan (sudah di navbar). */
export function ChatSessionHeader({ title, subtitle, live }: ChatSessionHeaderProps) {
  if (!title && !subtitle) return null;

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      {live && (
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
      )}
      <div className="min-w-0 flex-1">
        {title && <p className="truncate text-sm font-semibold">{title}</p>}
        {subtitle && (
          <p className="truncate text-[11px] text-primary">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
