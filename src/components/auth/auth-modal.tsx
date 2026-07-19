"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Logo } from "@/src/components/shared/logo";
import { LoginForm } from "@/src/components/auth/login-form";
import { RegisterForm } from "@/src/components/auth/register-form";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

export function AuthModal({ open, onOpenChange, defaultTab = "login" }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-1.25rem)] max-h-[calc(100dvh-1.25rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full sm:max-h-[min(90dvh,820px)]">
          <div className="relative shrink-0 border-b border-border/60 bg-gradient-to-b from-primary/5 to-background px-4 pb-3 pt-3 sm:px-6 sm:pb-5 sm:pt-4">
            <Dialog.Close className="absolute right-2.5 top-2.5 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:right-3 sm:top-3">
              <X className="h-4 w-4" />
            </Dialog.Close>

            <div className="flex flex-col items-center gap-2 pt-0.5 sm:gap-3 sm:pt-1">
              <Logo size="sm" showText className="max-w-full justify-center sm:hidden" />
              <Logo size="md" showText className="max-w-full justify-center hidden sm:flex" />
              <p className="text-center text-[10px] font-medium uppercase tracking-[0.1em] text-primary sm:text-[11px] sm:tracking-[0.12em]">
                Digital Assistant RSI Surabaya
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col items-center px-4 pt-4 pb-1 sm:px-6 sm:pt-5 sm:pb-2">
              <h2 className="text-lg font-bold text-foreground sm:text-xl">
                {tab === "login" ? "Masuk ke DARSI" : "Daftar Akun DARSI"}
              </h2>
              <p className="mt-0.5 text-center text-xs text-muted-foreground sm:mt-1 sm:text-sm">
                {tab === "login"
                  ? "Satu login untuk pasien, dokter, bidan, dan admin"
                  : "Lengkapi data pasien SIMRS dan buat akun login"}
              </p>
            </div>

            <div className="mx-4 mt-3 flex rounded-lg bg-muted p-1 sm:mx-6 sm:mt-4">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors sm:py-2",
                  tab === "login"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setTab("register")}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors sm:py-2",
                  tab === "register"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Daftar
              </button>
            </div>

            <div className="px-4 py-4 sm:px-6 sm:py-5">
              {tab === "login" ? (
                <LoginForm
                  onSwitchToRegister={() => setTab("register")}
                  onLoginSuccess={() => onOpenChange(false)}
                />
              ) : (
                <RegisterForm onSwitchToLogin={() => setTab("login")} />
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
