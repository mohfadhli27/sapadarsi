"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useUnifiedLogin } from "@/src/hooks/use-unified-login";
import { loginSchema, type LoginFormData } from "@/src/lib/validators";
import { DemoLoginPanel } from "@/src/components/shared/demo-login-panel";
import { isSapabidan } from "@/src/config/app-variant";

interface LoginFormProps {
  onSwitchToRegister?: () => void;
  onLoginSuccess?: () => void;
}

export function LoginForm({ onSwitchToRegister, onLoginSuccess }: LoginFormProps) {
  const { login, isLoading } = useUnifiedLogin();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormData) {
    setError("");
    try {
      const result = await login(data);
      if (result.accountType === "patient") {
        onLoginSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    }
  }

  function fillDemoAccount(username: string, password: string) {
    setError("");
    setSelectedDemo(username);
    setValue("email", username, { shouldValidate: true, shouldDirty: true });
    setValue("password", password, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Email atau Username</label>
          <Input
            placeholder={isSapabidan ? "pasien atau bidan" : "pasien, dokter, bidan, atau admin"}
            autoComplete="username"
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Password</label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan password"
              autoComplete="current-password"
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            "Memproses..."
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Masuk
            </>
          )}
        </Button>

        {onSwitchToRegister && (
          <p className="text-center text-sm text-muted-foreground">
            Belum punya akun pasien?{" "}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-medium text-primary hover:underline"
            >
              Daftar sekarang
            </button>
          </p>
        )}
      </form>

      <DemoLoginPanel onFillAccount={fillDemoAccount} selectedUsername={selectedDemo} />
    </div>
  );
}
