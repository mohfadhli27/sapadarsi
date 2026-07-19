"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/src/stores/auth-store";
import { useStaffAuthStore } from "@/src/stores/staff-auth-store";

function waitForHydration(store: {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}): Promise<void> {
  return new Promise((resolve) => {
    if (store.persist.hasHydrated()) {
      resolve();
      return;
    }
    store.persist.onFinishHydration(() => resolve());
  });
}

/** Tunggu patient + staff auth store selesai hydrate dari sessionStorage tab ini. */
export function useAuthStoresHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void Promise.all([
      waitForHydration(useAuthStore),
      waitForHydration(useStaffAuthStore),
    ]).then(() => setHydrated(true));
  }, []);

  return hydrated;
}

/** @deprecated gunakan useAuthStoresHydrated */
export function useAuthHydrated() {
  return useAuthStoresHydrated();
}
