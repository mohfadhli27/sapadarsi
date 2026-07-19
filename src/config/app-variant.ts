export type AppVariant = "sapadarsi" | "sapabidan";

/** Variant dari build — dipakai saat SSR tanpa Host header. */
export function variantFromBuildEnv(): AppVariant {
  return process.env.NEXT_PUBLIC_APP_VARIANT === "sapabidan" ? "sapabidan" : "sapadarsi";
}

/** Deteksi variant dari hostname request (lebih andal daripada env saat deploy terpisah). */
export function variantFromHost(host: string | null | undefined): AppVariant | null {
  const h = (host ?? "").toLowerCase();
  if (!h) return null;
  if (h.includes("sapabidan")) return "sapabidan";
  if (h.includes("sapadarsi") || h.includes("hcm-lab.id")) return "sapadarsi";
  return null;
}

export function resolveAppVariant(host?: string | null): AppVariant {
  return variantFromHost(host) ?? variantFromBuildEnv();
}

export function isSapabidanHost(host: string | null | undefined): boolean {
  return resolveAppVariant(host) === "sapabidan";
}

export const appVariant: AppVariant = variantFromBuildEnv();

export const isSapabidan = appVariant === "sapabidan";

export const isSapadarsi = appVariant === "sapadarsi";
