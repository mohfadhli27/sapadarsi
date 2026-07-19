/**
 * Agent khusus konsultasi dokter DARSI.
 * Pasien melihat percakapan sebagai dokter/koordinator RS — bukan chatbot.
 * Engine: Nemotron (orchestrator) + MedGemma (analisis klinis internal).
 */

import { runNemotronMedGemmaDoctorAgent } from "@/src/lib/nemotron-medgemma-orchestrator";

export type DoctorAgentPhase = "triage" | "greeting" | "consultation";

export type DoctorAgentContext = {
  phase: DoctorAgentPhase;
  doctorName?: string;
  unitName?: string;
  patientName?: string;
  patientHonorific?: string;
  patientShortHonorific?: string;
  patientAge?: number | null;
  patientSex?: string | null;
  doctorSpecialty?: string;
  initialComplaint?: string | null;
  triageSummary?: string | null;
  recommendedUnitName?: string;
  history?: Array<{ role: "patient" | "doctor" | "coordinator"; text: string }>;
  latestMessage?: string;
  suggestNewConsultation?: {
    complaint: string;
    label: string;
    unitHint: string;
  };
  isRepeatedRedirect?: boolean;
};

export type DoctorAgentResult = {
  patientText: string;
  riskLevel: "low" | "medium" | "high";
  clinicalNote: string;
  shouldEscalate: boolean;
  meta?: {
    orchestratorProfile: string;
    orchestratorModel: string;
    medgemmaModel: string;
    stack: string;
  };
};

export async function runDoctorAgent(ctx: DoctorAgentContext): Promise<DoctorAgentResult> {
  return runNemotronMedGemmaDoctorAgent(ctx);
}

/** Map DB sender ke tampilan pasien */
export function mapMessageForPatient(msg: {
  sender_type: string;
  message_text: string;
  edited_text: string | null;
  staff_actor: string | null;
  is_takeover: boolean;
}) {
  const text = msg.edited_text ?? msg.message_text;

  if (msg.sender_type === "patient") {
    return { role: "user" as const, content: text, senderName: undefined };
  }
  if (msg.sender_type === "system") {
    return { role: "system" as const, content: text, senderName: undefined };
  }
  if (msg.sender_type === "agent") {
    return { role: "coordinator" as const, content: text, senderName: "Koordinator Poli" };
  }
  if (msg.sender_type === "staff") {
    return {
      role: "doctor" as const,
      content: text,
      senderName: msg.staff_actor ?? "Dokter",
      isTakeover: msg.is_takeover,
    };
  }
  // Legacy ai → tampilkan sebagai dokter jika ada staff_actor di meta, else koordinator
  return { role: "coordinator" as const, content: text, senderName: "Koordinator Poli" };
}
