"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/stores/auth-store";
import { ROUTES } from "@/src/config/routes";
import { getPatientHomePath } from "@/src/lib/auth-redirect";
import type { LoginRequest, AuthResponse } from "@/src/types/auth";
import type { RegisterFormData } from "@/src/lib/validators";

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setAuth, logout: clearAuth, setLoading, isLoading } =
    useAuthStore();

  async function login(data: LoginRequest) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email.trim(),
          password: data.password,
        }),
      });

      const result: AuthResponse = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Login gagal");
      }

      if (result.user) {
        setAuth(result.user, String(result.user.patientId));
        router.replace(getPatientHomePath());
      }

      return result;
    } finally {
      setLoading(false);
    }
  }

  async function register(data: RegisterFormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result: AuthResponse = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Registrasi gagal");
      }

      if (result.user) {
        setAuth(result.user, String(result.user.patientId));
        router.replace(getPatientHomePath());
      }

      return result;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearAuth();
    router.push("/");
  }

  return { user, isAuthenticated, isLoading, login, register, logout };
}
