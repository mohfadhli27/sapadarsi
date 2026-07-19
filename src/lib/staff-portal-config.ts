import { isSapabidan } from "@/src/config/app-variant";
import { isAdminRole } from "@/src/lib/admin-roles";
import type { StaffRole, StaffUser } from "@/src/types/staff";

export function getDashboardPathForRole(role: StaffRole): string {
  if (isSapabidan) {
    if (role === "nurse") return "/staff/bidan";
    return "/?staff=unsupported";
  }

  if (isAdminRole(role)) return "/admin";
  if (role === "nurse") return "/staff/bidan";
  if (role === "pharmacist") return "/staff/apoteker";
  return "/staff/dokter";
}

export function isPractitionerRole(role: StaffRole | string | undefined): boolean {
  return role === "doctor" || role === "nurse";
}

export type PortalMeta = {
  title: string;
  subtitle: string;
  badge: string;
  accentClass: string;
};

export function getPortalMeta(staff: StaffUser | null | undefined): PortalMeta {
  if (!staff) {
    return {
      title: isSapabidan ? "Portal Bidan" : "Portal Tenaga Medis",
      subtitle: isSapabidan
        ? "Notifikasi dan persetujuan konsultasi bidan"
        : "Notifikasi dan persetujuan konsultasi",
      badge: isSapabidan ? "Sapabidan" : "RSI A. Yani",
      accentClass: "from-pink-500/10 to-rose-500/5",
    };
  }

  if (staff.role === "nurse") {
    return {
      title: "Portal Bidan",
      subtitle: "Notifikasi, persetujuan, dan monitor konsultasi ibu & anak",
      badge: isSapabidan ? "Tim Bidan Sapabidan" : "Tim Bidan RSI A. Yani",
      accentClass: "from-pink-500/10 to-rose-500/5",
    };
  }

  if (staff.role === "pharmacist") {
    return {
      title: "Portal Apoteker",
      subtitle: "Kelola pesanan resep obat dari pasien",
      badge: "Instalasi Farmasi RSI A. Yani",
      accentClass: "from-blue-500/10 to-indigo-500/5",
    };
  }

  return {
    title: "Portal Dokter",
    subtitle: "Notifikasi, persetujuan, dan monitor konsultasi pasien",
    badge: "Dokter RSI A. Yani",
    accentClass: "from-emerald-500/10 to-teal-500/5",
  };
}
