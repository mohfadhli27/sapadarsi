"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/src/types/auth";
import {
  AUTH_STORAGE_KEY,
  clearLegacyAuthLocalStorage,
  tabAuthStorage,
} from "@/src/lib/tab-auth-storage";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      setAuth: (user, token) => {
        clearLegacyAuthLocalStorage();
        set({ user, token, isAuthenticated: true, isLoading: false });
      },
      logout: () => {
        clearLegacyAuthLocalStorage();
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: tabAuthStorage,
    }
  )
);
