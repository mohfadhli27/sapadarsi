"use client";

import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Printer, X } from "lucide-react";
import { Button } from "@/src/components/ui/button";

type DocumentViewerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title?: string;
};

function withEmbedParam(url: string) {
  const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  parsed.searchParams.set("embed", "1");
  return `${parsed.pathname}${parsed.search}`;
}

export function DocumentViewerSheet({
  open,
  onOpenChange,
  url,
  title = "Dokumen",
}: DocumentViewerSheetProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const src = url ? withEmbedParam(url) : null;

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-0 z-[101] flex flex-col bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:inset-x-3 sm:inset-y-4 sm:left-1/2 sm:max-h-[min(92dvh,920px)] sm:max-w-3xl sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 py-2.5 safe-area-top">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {title}
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak / PDF
              </Button>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-muted/20">
            {src ? (
              <iframe
                ref={iframeRef}
                src={src}
                title={title}
                className="h-full w-full border-0 bg-white"
              />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
