"use client";

import { useState, useRef, useEffect } from "react";
import { SendHorizonal, Paperclip } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  allowPdfUpload?: boolean;
  onUploadPdf?: (file: File) => Promise<void>;
  uploadDisabled?: boolean;
  maxUploadMb?: number;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ketik keluhan Anda...",
  allowPdfUpload = false,
  onUploadPdf,
  uploadDisabled = false,
  maxUploadMb = 10,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadPdf) return;

    const maxBytes = maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`Ukuran file maksimal ${maxUploadMb} MB`);
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Hanya file PDF yang diterima");
      return;
    }

    setUploading(true);
    try {
      await onUploadPdf(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        {allowPdfUpload && onUploadPdf && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl"
              disabled={disabled || uploadDisabled || uploading}
              title="Upload resep PDF"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
        >
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </div>
      {allowPdfUpload && (
        <p className="mx-auto mt-2 max-w-3xl text-[10px] text-muted-foreground">
          Upload resep PDF dari dokter/bidan (maks. {maxUploadMb} MB)
        </p>
      )}
    </div>
  );
}
