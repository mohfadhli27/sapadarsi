"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, LogIn, Shield } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Logo } from "@/src/components/shared/logo";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { isAdminRole } from "@/src/lib/admin-roles";
import type { StaffLoginResponse } from "@/src/types/staff";
import { cn } from "@/src/lib/utils";

const inputClass =
  "h-11 rounded-xl border-border/80 bg-muted/30 px-3.5 text-sm shadow-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:ring-offset-0";

export function AdminLoginForm() {
  const router = useRouter();
  const setAuth = useStaffAuthStore((s) => s.setAuth);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/staff/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const result: StaffLoginResponse = await res.json();
      if (!res.ok || !result.success || !result.staff || !result.sessionToken) {
        throw new Error(result.message ?? "Login gagal");
      }
      if (!isAdminRole(result.staff.role)) {
        throw new Error("Akun ini bukan admin/CS. Gunakan portal dokter.");
      }
      setAuth(result.staff, result.sessionToken);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-6 sm:py-10">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-xl shadow-primary/5">
        <div className="border-b bg-gradient-to-br from-sky-500/[0.08] via-background to-background px-6 pb-6 pt-8 text-center">
          <Logo size="md" className="mx-auto justify-center" />
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3.5 py-1.5 text-xs font-medium text-sky-800 dark:text-sky-300">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            Administrasi DARSI
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">Masuk Admin / CS</h1>
          <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
            Pantau sinkronisasi dokter RSI, akun staff, dan konsultasi pasien
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
            <label htmlFor="admin-identifier" className="text-sm font-medium">
              Username atau email
            </label>
            <Input
              id="admin-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin / koordinator"
              autoComplete="username"
              className={inputClass}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="admin-password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(inputClass, "pr-11")}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="h-11 w-full gap-2 rounded-xl" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Memproses..." : "Masuk Administrasi"}
          </Button>
        </form>

        <div className="border-t bg-muted/20 px-6 py-4 text-center text-xs text-muted-foreground">
          <Link href="/staff/login" className="font-medium text-primary hover:underline">
            Portal dokter
          </Link>
          {" · "}
          <Link href="/" className="font-medium text-primary hover:underline">
            Halaman pasien
          </Link>
        </div>
      </div>
    </div>
  );
}
