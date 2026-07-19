import { createJSONStorage } from "zustand/middleware";

export const AUTH_STORAGE_KEY = "darsi-auth";
export const STAFF_AUTH_STORAGE_KEY = "darsi-staff-auth";

const LEGACY_KEYS = [AUTH_STORAGE_KEY, STAFF_AUTH_STORAGE_KEY] as const;

/** Sesi login per tab — tidak sinkron antar tab browser. */
export const tabAuthStorage = createJSONStorage(() => sessionStorage);

/** Pindahkan auth lama dari localStorage (shared tab) ke sessionStorage sekali. */
export function migrateLegacyAuthStorage() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, legacy);
    }
    localStorage.removeItem(key);
  }
}

// Jalankan sebelum Zustand persist membaca sessionStorage (saat modul di-import).
if (typeof window !== "undefined") {
  migrateLegacyAuthStorage();
}

export function clearLegacyAuthLocalStorage() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}
