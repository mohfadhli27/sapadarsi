"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, LogIn, Stethoscope } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Logo } from "@/src/components/shared/logo";
import { useStaffAuth } from "@/src/hooks/use-staff-auth";
import { DemoLoginPanel } from "@/src/components/shared/demo-login-panel";
import { cn } from "@/src/lib/utils";

const inputClass =
  "h-11 rounded-xl border-border/80 bg-muted/30 px-3.5 text-sm shadow-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:ring-offset-0";

export function StaffLoginForm() {
  const { login, isLoading } = useStaffAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [selectedDemo, setSelectedDemo] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    }
  }

  function fillDemoAccount(username: string, password: string) {
    setError("");
    setSelectedDemo(username);
    setIdentifier(username);
    setPassword(password);
  }

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-6 sm:py-10">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-xl shadow-primary/5">
        <div className="border-b bg-gradient-to-br from-emerald-500/[0.08] via-background to-background px-6 pb-6 pt-8 text-center">
          <Logo size="md" className="mx-auto justify-center" />
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <Stethoscope className="h-3.5 w-3.5 shrink-0" />
            Portal Dokter RSI A. Yani
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">
            Masuk sebagai Dokter
          </h1>
          <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
            Kelola konsultasi pasien dan tanggapi permintaan secara realtime
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="staff-identifier" className="text-sm font-medium text-foreground">
              Username atau email
            </label>
            <Input
              id="staff-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="contoh: dr_sheila_nalia"
              autoComplete="username"
              className={inputClass}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="staff-password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <Input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                className={cn(inputClass, "pr-11")}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full gap-2 rounded-xl text-sm font-semibold shadow-sm"
            disabled={isLoading}
          >
            <LogIn className="h-4 w-4" />
            {isLoading ? "Memproses..." : "Masuk ke Portal"}
          </Button>

          <DemoLoginPanel
            onFillAccount={fillDemoAccount}
            selectedUsername={selectedDemo}
          />
        </form>

        <div className="border-t bg-muted/20 px-6 py-4">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Akun dokter diberikan oleh administrator RSI.
            <br />
            Hubungi IT rumah sakit jika belum memiliki akses.
          </p>
          <p className="mt-3 text-center text-xs">
            <Link
              href="/"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Kembali ke halaman pasien
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
