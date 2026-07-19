import { appVariant } from "@/src/config/app-variant";
import { getBrand } from "@/src/config/brand";

/** URL publik produksi DARSI (tanpa trailing slash) */
export const DARSI_PUBLIC_BASE_URL = "https://sapadarsi.hcm-lab.id";

const LEGACY_PUBLIC_URLS = ["https://chatbotapt.hcm-lab.id", "http://chatbotapt.hcm-lab.id"];

export function resolveDarsiPublicUrl(envValue?: string | null): string {
  const publicBase = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (publicBase && !LEGACY_PUBLIC_URLS.includes(publicBase)) {
    return publicBase;
  }

  const trimmed = envValue?.trim().replace(/\/$/, "") ?? "";
  if (trimmed && !LEGACY_PUBLIC_URLS.includes(trimmed)) {
    return trimmed;
  }

  return getBrand().publicUrl.replace(/\/$/, "");
}

const brand = getBrand(appVariant);

export const siteConfig = {
  name: brand.name,
  orgName: brand.orgName,
  orgFullName: brand.orgFullName,
  fullName: brand.fullName,
  description: brand.description,
  url: resolveDarsiPublicUrl(process.env.DARSI_PUBLIC_URL),
  variant: appVariant,
} as const;
