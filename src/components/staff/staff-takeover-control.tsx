"use client";

import { Bot, Hand, Send, Sparkles } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

type Props = {
  takeoverActive: boolean;
  doctorName: string;
  actionLoading?: boolean;
  message: string;
  onMessageChange: (value: string) => void;
  onEnableTakeover: () => void;
  onDisableTakeover: () => void;
  onSendMessage: () => void;
};

export function StaffTakeoverControl({
  takeoverActive,
  doctorName,
  actionLoading,
  message,
  onMessageChange,
  onEnableTakeover,
  onDisableTakeover,
  onSendMessage,
}: Props) {
  if (!takeoverActive) {
    return (
      <div className="bg-background px-4 py-4 lg:px-5">
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 lg:min-w-0 lg:flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  Asisten AI aktif
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-200/80">
                  Balasan otomatis dikirim ke pasien atas nama {doctorName}. Edit atau sembunyikan
                  pesan jika respons kurang tepat.
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="h-11 w-full shrink-0 gap-2 rounded-xl lg:w-auto lg:px-6"
              disabled={actionLoading}
              onClick={onEnableTakeover}
            >
              <Hand className="h-4 w-4" />
              Ambil alih chat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-3 lg:px-5 dark:border-amber-900 dark:bg-amber-950/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
              <Hand className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                Mode ambil alih — Anda yang mengetik
              </p>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                Asisten AI dinonaktifkan. Hanya pesan dari Anda yang dikirim ke pasien.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 shrink-0 gap-1.5 rounded-lg border-amber-300 bg-white text-xs",
              "hover:bg-amber-100 dark:border-amber-800 dark:bg-transparent"
            )}
            disabled={actionLoading}
            onClick={onDisableTakeover}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Kembalikan ke asisten AI
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={2}
            disabled={actionLoading}
            placeholder={`Tulis jawaban sebagai ${doctorName}...`}
            className="min-h-[72px] flex-1 resize-none rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (message.trim()) onSendMessage();
              }
            }}
          />
          <Button
            type="button"
            className="h-11 shrink-0 gap-2 rounded-xl px-5 sm:w-auto"
            disabled={actionLoading || !message.trim()}
            onClick={onSendMessage}
          >
            <Send className="h-4 w-4" />
            Kirim ke pasien
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Enter untuk kirim · Shift+Enter baris baru
        </p>
      </div>
    </div>
  );
}
