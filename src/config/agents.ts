import type { AgentRole } from "@/src/types/chat";
import { ROUTES } from "@/src/config/routes";
import { isRoleEnabledForVariant } from "@/src/config/brand";

export type AgentCard = {
  role: AgentRole;
  name: string;
  description: string;
  icon: "Stethoscope" | "Baby" | "Pill";
  href: string;
  available: boolean;
  accent: string;
};

const ALL_AGENT_CARDS: AgentCard[] = [
  {
    role: "dokter",
    name: "Konsultasi Dokter",
    description:
      "Triase keluhan, pilih dokter spesialis RSI, konsultasi live yang dipantau tenaga medis.",
    icon: "Stethoscope",
    href: ROUTES.chat("dokter"),
    available: true,
    accent: "from-emerald-500/10 to-teal-500/5",
  },
  {
    role: "bidan",
    name: "Konsultasi Bidan",
    description:
      "Konsultasi awal kehamilan, kesehatan ibu, dan tumbuh kembang anak dengan tim bidan RSI.",
    icon: "Baby",
    href: ROUTES.chat("bidan"),
    available: true,
    accent: "from-pink-500/10 to-rose-500/5",
  },
  {
    role: "apoteker",
    name: "Konsultasi Apoteker",
    description:
      "Tanya obat bebas, dosis, interaksi, dan saran penggunaan obat dengan apoteker RSI.",
    icon: "Pill",
    href: ROUTES.chat("apoteker"),
    available: true,
    accent: "from-violet-500/10 to-indigo-500/5",
  },
];

export function getAgentCards(): AgentCard[] {
  return ALL_AGENT_CARDS.filter((c) => isRoleEnabledForVariant(c.role));
}

export const AGENT_CARDS: AgentCard[] = getAgentCards();

export interface AgentConfig {
  id: AgentRole | "home-care";
  name: string;
  description: string;
  icon: string;
  endpoint: string | null;
  available: boolean;
  color: string;
}

export const AGENTS: Record<string, AgentConfig> = {
  dokter: {
    id: "dokter",
    name: "Konsultasi Dokter",
    description: "Konsultasi keluhan medis umum dengan AI",
    icon: "Stethoscope",
    endpoint: "/api/chat?role=dokter",
    available: true,
    color: "primary",
  },
  bidan: {
    id: "bidan",
    name: "Konsultasi Bidan",
    description: "Konsultasi kesehatan ibu dan anak",
    icon: "Baby",
    endpoint: "/api/chat?role=bidan",
    available: true,
    color: "primary",
  },
  apoteker: {
    id: "apoteker",
    name: "Konsultasi Apoteker",
    description: "Informasi obat dan farmasi",
    icon: "Pill",
    endpoint: "/api/chat?role=apoteker",
    available: true,
    color: "primary",
  },
  homeCare: {
    id: "home-care",
    name: "Home Care",
    description: "Layanan perawatan di rumah",
    icon: "Home",
    endpoint: null,
    available: false,
    color: "muted",
  },
} as const;

export function isValidAgentRole(role: string): role is AgentRole {
  return role === "dokter" || role === "bidan" || role === "apoteker";
}

export function isAgentRoleAvailable(role: string): role is AgentRole {
  return isValidAgentRole(role) && isRoleEnabledForVariant(role);
}
