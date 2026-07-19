"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useAuth } from "@/src/hooks/use-auth";
import { registerSchema, type RegisterFormData } from "@/src/lib/validators";

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { register: registerUser, isLoading } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      sex: undefined,
      nickname: "",
      nik: "",
    },
  });

  async function onSubmit(data: RegisterFormData) {
    setError("");
    setSuccess("");
    try {
      const result = await registerUser(data);
      if (result?.success && result.user) {
        setSuccess(
          result.message ||
            `Registrasi berhasil. No. RM Anda: ${result.user.medicalRecordNumber}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrasi gagal");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary">
          {success}
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Data Pasien SIMRS
      </p>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Nama Lengkap
        </label>
        <Input placeholder="Sesuai KTP" {...register("name")} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Nama Panggilan
        </label>
        <Input placeholder="Opsional" {...register("nickname")} />
        {errors.nickname && (
          <p className="text-xs text-destructive">{errors.nickname.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">NIK</label>
        <Input placeholder="16 digit (opsional)" {...register("nik")} />
        {errors.nik && (
          <p className="text-xs text-destructive">{errors.nik.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Jenis Kelamin
          </label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register("sex")}
          >
            <option value="">Pilih</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
          {errors.sex && (
            <p className="text-xs text-destructive">{errors.sex.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Tanggal Lahir
          </label>
          <Input type="date" {...register("birthDate")} />
          {errors.birthDate && (
            <p className="text-xs text-destructive">{errors.birthDate.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Alamat</label>
        <Input placeholder="Maks. 50 karakter" {...register("address")} />
        {errors.address && (
          <p className="text-xs text-destructive">{errors.address.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            No. HP
          </label>
          <Input placeholder="08xxxxxxxxxx" {...register("phone")} />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            WhatsApp
          </label>
          <Input placeholder="08xxxxxxxxxx" {...register("whatsapp")} />
          {errors.whatsapp && (
            <p className="text-xs text-destructive">{errors.whatsapp.message}</p>
          )}
        </div>
      </div>

      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Akun Login
      </p>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <Input
          type="email"
          placeholder="email@contoh.com"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Username
        </label>
        <Input
          placeholder="contoh: siti_aisyah"
          autoComplete="username"
          {...register("username")}
        />
        {errors.username && (
          <p className="text-xs text-destructive">{errors.username.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Password
          </label>
          <Input
            type="password"
            placeholder="Min. 8 karakter"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Konfirmasi
          </label>
          <Input
            type="password"
            placeholder="Ulangi password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Data pasien disimpan ke SIMRS dummy. No. RM dibuat otomatis setelah
        registrasi.
      </p>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          "Memproses..."
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            Daftar Pasien
          </>
        )}
      </Button>

      {onSwitchToLogin && (
        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary hover:underline"
          >
            Masuk di sini
          </button>
        </p>
      )}
    </form>
  );
}
