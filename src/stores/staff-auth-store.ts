"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StaffUser } from "@/src/types/staff";
import {
  STAFF_AUTH_STORAGE_KEY,
  clearLegacyAuthLocalStorage,
  tabAuthStorage,
} from "@/src/lib/tab-auth-storage";

interface StaffAuthState {
  staff: StaffUser | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (staff: StaffUser, sessionToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useStaffAuthStore = create<StaffAuthState>()(
  persist(
    (set) => ({
      staff: null,
      sessionToken: null,
      isAuthenticated: false,
      isLoading: false,
      setAuth: (staff, sessionToken) => {
        clearLegacyAuthLocalStorage();
        set({ staff, sessionToken, isAuthenticated: true, isLoading: false });
      },
      logout: () => {
        clearLegacyAuthLocalStorage();
        set({ staff: null, sessionToken: null, isAuthenticated: false, isLoading: false });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: STAFF_AUTH_STORAGE_KEY,
      storage: tabAuthStorage,
    }
  )
);
