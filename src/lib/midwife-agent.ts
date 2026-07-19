/**
 * Agent konsultasi bidan/perawat — Nemotron (orchestrator) + MedGemma (brief klinis).
 */

import { runNemotronMedGemmaMidwifeAgent } from "@/src/lib/midwife-nemotron-orchestrator";

export type MidwifeAgentPhase = "greeting" | "consultation";

export type MidwifeAgentContext = {
  phase: MidwifeAgentPhase;
  practitionerName?: string;
  patientName?: string;
  patientHonorific?: string;
  patientAge?: number | null;
  patientSex?: string | null;
  initialComplaint?: string | null;
  history?: Array<{ role: "patient" | "midwife" | "coordinator"; text: string }>;
  latestMessage?: string;
  openingLive?: boolean;
};

export type MidwifeAgentResult = {
  reply: string;
  riskLevel: "low" | "medium" | "high";
  recommendation: string;
  shouldEscalate: boolean;
  meta?: {
    orchestratorProfile: string;
    orchestratorModel: string;
    medgemmaModel: string;
    stack: string;
  };
};

export async function runMidwifeAgent(ctx: MidwifeAgentContext): Promise<MidwifeAgentResult> {
  return runNemotronMedGemmaMidwifeAgent(ctx);
}
