import type { AgentRole } from "@/src/types/chat";
import { appVariant, type AppVariant } from "@/src/config/app-variant";

export const brandConfig = {
  sapadarsi: {
    name: "DARSI",
    fullName: "Digital Assistant RSI Surabaya A. Yani",
    description:
      "Layanan konsultasi kesehatan digital berbasis AI untuk RSI Surabaya A. Yani",
    publicUrl: "https://sapadarsi.hcm-lab.id",
    orgName: "Yarsis",
    orgFullName: "Yayasan Rumah Sakit Islam Surabaya",
    enabledRoles: ["dokter", "bidan", "apoteker"] as const satisfies readonly AgentRole[],
    showHomeCare: true,
    heroTitle: "Asisten Kesehatan Digital",
    heroSubtitle: "Digital Assistant RSI Surabaya A. Yani",
    heroDescription:
      "Konsultasi awal berbasis AI, terhubung langsung ke tenaga medis RSI Surabaya A. Yani.",
    disclaimerBrand: "DARSI",
  },
  sapabidan: {
    name: "Sapabidan",
    fullName: "Sapabidan",
    description: "Layanan konsultasi bidan digital untuk kesehatan ibu dan anak",
    publicUrl: "https://sapabidan.labvr.unusa.ac.id",
    orgName: "Ikatan Bidan Indonesia",
    orgFullName: "Ikatan Bidan Indonesia",
    enabledRoles: ["bidan"] as const satisfies readonly AgentRole[],
    showHomeCare: false,
    heroTitle: "Sapabidan",
    heroSubtitle: "Layanan Konsultasi Bidan Digital",
    heroDescription:
      "Konsultasi awal seputar kehamilan, kesehatan ibu, dan tumbuh kembang anak bersama layanan bidan.",
    disclaimerBrand: "Sapabidan",
  },
} as const;

export type BrandConfig = (typeof brandConfig)[AppVariant];

export function getBrand(variant: AppVariant = appVariant): BrandConfig {
  return brandConfig[variant];
}

export function isRoleEnabledForVariant(role: AgentRole, variant: AppVariant = appVariant): boolean {
  return (getBrand(variant).enabledRoles as readonly AgentRole[]).includes(role);
}
