/**
 * Kapan MedGemma brief dijalankan — tetap dipakai untuk akurasi klinis,
 * dilewati hanya pada turn ringan (penutup / jawaban sangat pendek).
 */

import { isPatientClosingMessage } from "@/src/lib/interview-context";
import { resolveConsultationInterviewPhase } from "@/src/lib/interview-phase";

export { isPatientClosingMessage };

export function shouldRunMedGemmaBrief(input: {
  phase: "triage" | "greeting" | "consultation";
  openingLive?: boolean;
  latestMessage?: string;
  hasPriorClinicianReply?: boolean;
  history?: Array<{ role: string; text: string }>;
  initialComplaint?: string | null;
}): boolean {
  if (input.phase === "triage" || input.phase === "greeting" || input.openingLive) {
    return true;
  }

  if (isPatientClosingMessage(input.latestMessage)) {
    return false;
  }

  const phase = resolveConsultationInterviewPhase({
    history: input.history,
    latestMessage: input.latestMessage,
    initialComplaint: input.initialComplaint,
  });
  if (phase === "closing") {
    return false;
  }

  if (!input.hasPriorClinicianReply) {
    return true;
  }

  const msg = input.latestMessage?.trim() ?? "";
  if (msg.length >= 10) {
    return true;
  }

  return false;
}
