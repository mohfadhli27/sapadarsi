"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { LegalSection, LegalShell } from "@/src/components/legal/legal-shell";
import { getBrand } from "@/src/config/brand";
import { useAuthStore } from "@/src/stores/auth-store";
import { useAuth } from "@/src/hooks/use-auth";

const brand = getBrand();

export default function HapusAkunPage() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!user?.patientId) {
      setError("Silakan masuk sebagai pasien terlebih dahulu.");
      return;
    }
    if (!password) {
      setError("Masukkan password untuk konfirmasi.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: user.patientId, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menghapus akun");
      }
      setSuccess(data.message);
      setPassword("");
      setTimeout(() => {
        logout();
        router.push("/");
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus akun");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LegalShell title="Hapus akun">
      <p className="legal-prose mb-5">
        Hanya untuk akun pasien yang Anda daftarkan sendiri. Akun dokter, bidan, apoteker, atau
        staff dikelola administrator rumah sakit.
      </p>

      <div className="surface-inset mb-6 space-y-2 p-4">
        <p className="text-sm font-medium text-foreground">Sebelum menghapus</p>
        <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
          <li>Login dengan email atau username ini tidak akan bisa digunakan lagi.</li>
          <li>Riwayat rekam medis di RS dapat tetap disimpan sesuai hukum.</li>
          <li>Penonaktifan akun staff dilakukan melalui administrator.</li>
        </ul>
      </div>

      {!user?.patientId ? (
        <div className="surface-inset p-6 text-center">
          <p className="text-sm text-muted-foreground">Masuk sebagai pasien untuk melanjutkan.</p>
          <Button asChild className="mt-4 h-10 rounded-[0.7rem] px-6">
            <Link href="/?auth=login">Masuk</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Akun aktif</p>
            <p className="mt-1 text-[0.9375rem] font-medium text-foreground">
              {user.email || user.username}
            </p>
            {user.medicalRecordNumber ? (
              <p className="data-mono mt-1 text-muted-foreground">RM {user.medicalRecordNumber}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="delete-password" className="text-sm font-medium text-foreground">
              Konfirmasi password
            </label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password akun Anda"
              autoComplete="current-password"
              className="h-11 rounded-[0.7rem] border-border/70"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-primary">{success}</p> : null}
          <Button
            type="button"
            variant="destructive"
            className="h-11 w-full rounded-[0.7rem] font-medium transition-transform active:scale-[0.99]"
            disabled={loading}
            onClick={() => void handleDelete()}
          >
            {loading ? "Memproses..." : "Hapus akun login"}
          </Button>
        </div>
      )}

      <LegalSection title="Butuh bantuan?">
        <p>
          Untuk penonaktifan akun staff atau pertanyaan data, hubungi administrator RSI A. Yani
          atau koordinator {brand.name}.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
