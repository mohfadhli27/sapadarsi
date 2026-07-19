import type { AgentRole } from "@/src/types/chat";

export type ConsultationServiceType =
  | "nurse_consultation"
  | "midwife_consultation"
  | "doctor_consultation"
  | "pharmacist_consultation";

/** Map frontend role ke serviceType backend */
export const ROLE_TO_SERVICE: Partial<Record<AgentRole, ConsultationServiceType>> = {
  bidan: "midwife_consultation",
  dokter: "doctor_consultation",
  apoteker: "pharmacist_consultation",
};

export function isConsultationRole(role: AgentRole): role is keyof typeof ROLE_TO_SERVICE {
  return role in ROLE_TO_SERVICE;
}

export function getServiceTypeForRole(role: AgentRole): ConsultationServiceType | null {
  return ROLE_TO_SERVICE[role] ?? null;
}
