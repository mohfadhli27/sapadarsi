import {
  Stethoscope,
  Baby,
  Pill,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/src/config/routes";
import { isRoleEnabledForVariant } from "@/src/config/brand";
import type { AgentRole } from "@/src/types/chat";

export type ConsultationService = {
  id: AgentRole;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  iconBg: string;
  menuColor: string;
  href: string;
  available: boolean;
};

export const ALL_CONSULTATION_SERVICES: ConsultationService[] = [
  {
    id: "dokter",
    label: "Konsultasi Dokter",
    subtitle: "Medis umum & spesialis RSI",
    icon: Stethoscope,
    iconBg: "bg-emerald-500",
    menuColor:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    href: ROUTES.chat("dokter"),
    available: true,
  },
  {
    id: "bidan",
    label: "Konsultasi Bidan",
    subtitle: "Kesehatan ibu & anak",
    icon: Baby,
    iconBg: "bg-pink-500",
    menuColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
    href: ROUTES.chat("bidan"),
    available: true,
  },
  {
    id: "apoteker",
    label: "Konsultasi Apoteker",
    subtitle: "Info obat & farmasi",
    icon: Pill,
    iconBg: "bg-blue-500",
    menuColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    href: ROUTES.chat("apoteker"),
    available: true,
  },
];

export function getConsultationServices(): ConsultationService[] {
  return ALL_CONSULTATION_SERVICES.filter((s) => isRoleEnabledForVariant(s.id));
}

/** Layanan konsultasi yang aktif untuk variant saat ini */
export const CONSULTATION_SERVICES = getConsultationServices();

export function consultationAgentLabel(role: AgentRole): string {
  return ALL_CONSULTATION_SERVICES.find((s) => s.id === role)?.label ?? "Konsultasi";
}
