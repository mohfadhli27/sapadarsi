"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/src/stores/auth-store";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";
import { resolveLoginDestination } from "@/src/lib/auth-redirect";
import type { AuthResponse } from "@/src/types/auth";
import type { StaffLoginResponse } from "@/src/types/staff";
import type { LoginFormData } from "@/src/lib/validators";

export function useUnifiedLogin() {
  const router = useRouter();
  const setPatientAuth = useAuthStore((s) => s.setAuth);
  const clearPatientAuth = useAuthStore((s) => s.logout);
  const setPatientLoading = useAuthStore((s) => s.setLoading);
  const setStaffAuth = useStaffAuthStore((s) => s.setAuth);
  const clearStaffAuth = useStaffAuthStore((s) => s.logout);
  const setStaffLoading = useStaffAuthStore((s) => s.setLoading);
  const [isLoading, setIsLoading] = useState(false);

  async function login(data: LoginFormData) {
    setIsLoading(true);
    setPatientLoading(true);
    setStaffLoading(true);

    try {
      const identifier = data.email.trim();
      const password = data.password;

      const patientRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, email: identifier, password }),
      });
      const patientResult: AuthResponse = await patientRes.json();

      if (patientRes.ok && patientResult.success && patientResult.user) {
        clearStaffAuth();
        setPatientAuth(patientResult.user, String(patientResult.user.patientId));
        const dest = resolveLoginDestination({ accountType: "patient" });
        router.replace(dest.path);
        return dest;
      }

      const staffRes = await fetch("/api/staff/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const staffResult: StaffLoginResponse = await staffRes.json();

      if (staffRes.ok && staffResult.success && staffResult.staff && staffResult.sessionToken) {
        clearPatientAuth();
        setStaffAuth(staffResult.staff, staffResult.sessionToken);
        const dest = resolveLoginDestination({
          accountType: "staff",
          role: staffResult.staff.role,
        });
        router.replace(dest.path);
        return dest;
      }

      throw new Error("Email/username atau password salah.");
    } finally {
      setIsLoading(false);
      setPatientLoading(false);
      setStaffLoading(false);
    }
  }

  return { login, isLoading };
}
