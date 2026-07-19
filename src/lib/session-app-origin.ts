import type { AppVariant } from "@/src/config/app-variant";
import { getBrand } from "@/src/config/brand";
import { resolveDarsiPublicUrl } from "@/src/config/site";
import { dbQuery } from "@/src/lib/db";

/** URL publik aplikasi yang sedang menangani request (tanpa trailing slash). */
export function currentAppPublicUrl(): string {
  return resolveDarsiPublicUrl(process.env.DARSI_PUBLIC_URL);
}

export function publicUrlForVariant(variant: AppVariant): string {
  return getBrand(variant).publicUrl.replace(/\/$/, "");
}

export const SAPADARSI_PUBLIC_URL = publicUrlForVariant("sapadarsi");
export const SAPABIDAN_PUBLIC_URL = publicUrlForVariant("sapabidan");

/** Chat & portal apotek pasien hanya tersedia di Sapadarsi. */
export function pharmacyPatientPublicUrl(): string {
  return SAPADARSI_PUBLIC_URL;
}

export function pharmacyStaffPublicUrl(): string {
  return SAPADARSI_PUBLIC_URL;
}

export function resolveSessionPublicUrl(stored?: string | null): string {
  const trimmed = stored?.trim().replace(/\/$/, "");
  if (trimmed) return trimmed;
  return currentAppPublicUrl();
}

/** Domain alternatif untuk akses silang monitor (token sama, DB sama). */
export function crossAppPublicUrl(originUrl: string): string | null {
  const normalized = originUrl.replace(/\/$/, "");
  if (normalized === SAPABIDAN_PUBLIC_URL) return SAPADARSI_PUBLIC_URL;
  if (normalized === SAPADARSI_PUBLIC_URL) return SAPABIDAN_PUBLIC_URL;
  return null;
}

export async function getSessionAppOriginUrl(sessionId: number): Promise<string> {
  const result = await dbQuery<{ app_origin_url: string | null }>(
    `select app_origin_url from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  return resolveSessionPublicUrl(result.rows[0]?.app_origin_url);
}

export function buildPharmacyPatientChatUrl(): string {
  return `${pharmacyPatientPublicUrl()}/chat/apoteker`;
}

export function buildPharmacyStaffPortalUrl(orderId?: number): string {
  const base = `${pharmacyStaffPublicUrl()}/staff/apoteker`;
  return orderId ? `${base}?order=${orderId}` : base;
}
