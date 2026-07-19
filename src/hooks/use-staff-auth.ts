"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { resolveLoginDestination } from "@/src/lib/auth-redirect";
import type { StaffLoginResponse } from "@/src/types/staff";

export function useStaffAuth() {
  const router = useRouter();
  const { staff, sessionToken, isAuthenticated, setAuth, logout, setLoading, isLoading } =
    useStaffAuthStore();

  function authHeaders(): HeadersInit {
    if (!sessionToken) return {};
    return {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    };
  }

  async function login(identifier: string, password: string) {
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

      setAuth(result.staff, result.sessionToken);
      router.replace(
        resolveLoginDestination({ accountType: "staff", role: result.staff.role }).path
      );
      return result;
    } finally {
      setLoading(false);
    }
  }

  async function logoutStaff() {
    if (sessionToken) {
      try {
        await fetch("/api/staff/auth/logout", {
          method: "POST",
          headers: authHeaders(),
        });
      } catch {
        /* ignore */
      }
    }
    logout();
    router.push("/?auth=login");
  }

  return {
    staff,
    sessionToken,
    isAuthenticated,
    isLoading,
    login,
    logout: logoutStaff,
    authHeaders,
  };
}

export function useStaffFetch() {
  const sessionToken = useStaffAuthStore((s) => s.sessionToken);

  return useCallback(
    async function staffFetch(input: RequestInfo, init?: RequestInit) {
      const headers = new Headers(init?.headers);
      if (sessionToken) {
        headers.set("Authorization", `Bearer ${sessionToken}`);
      }
      return fetch(input, { ...init, headers });
    },
    [sessionToken]
  );
}
