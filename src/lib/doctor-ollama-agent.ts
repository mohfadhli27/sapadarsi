/**
 * Fallback dokter via Ollama lokal (MedGemma / darsi-llama) — alur lama yang cepat & natural
 * saat Nemotron DGX tidak tersedia.
 */

import { z } from "zod";
import type { DoctorAgentContext, DoctorAgentResult } from "@/src/lib/doctor-agent";
import {
  buildDoctorSystemPrompt,
  buildDoctorUserPrompt,
  sanitizeDoctorReplyText,
} from "@/src/lib/doctor-consultation-format";
import {
  getReplyValidationIssue,
  type ReplyValidationContext,
} from "@/src/lib/agent-reply-validator";
import {
  buildSoftAssessmentReply,
  resolveConsultationInterviewPhase,
} from "@/src/lib/interview-phase";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://10.9.23.200:11434";
const OLLAMA_MODEL =
  process.env.OLLAMA_DOCTOR_MODEL?.trim() ||
  process.env.OLLAMA_ORCHESTRATOR_MODEL?.trim() ||
  "llama3.1:8b";

const doctorResponseSchema = z.object({
  patientText: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  clinicalNote: z.string().optional().default(""),
  shouldEscalate: z.boolean().optional().default(false),
});

function parseDoctorOllamaResponse(raw: string, isFollowUp: boolean): DoctorAgentResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      patientText: sanitizeDoctorReplyText(raw.trim(), isFollowUp),
      riskLevel: "low",
      clinicalNote: "",
      shouldEscalate: false,
    };
  }

  try {
    const parsed = doctorResponseSchema.parse(JSON.parse(jsonMatch[0]));
    return {
      patientText: sanitizeDoctorReplyText(parsed.patientText, isFollowUp),
      riskLevel: parsed.riskLevel,
      clinicalNote: parsed.clinicalNote ?? "",
      shouldEscalate: parsed.shouldEscalate ?? false,
    };
  } catch {
    return {
      patientText: sanitizeDoctorReplyText(raw.trim(), isFollowUp),
      riskLevel: "low",
      clinicalNote: "",
      shouldEscalate: false,
    };
  }
}

export async function runDoctorOllamaAgent(ctx: DoctorAgentContext): Promise<DoctorAgentResult> {
  const honorific = ctx.patientHonorific ?? "Bapak/Ibu";
  const doctorName = ctx.doctorName ?? "Dokter";
  const unitName = ctx.unitName ?? "Poli";
  const { prompt, isFollowUp } = buildDoctorUserPrompt({
    doctorName,
    unitName,
    doctorSpecialty: ctx.doctorSpecialty,
    honorific,
    patientSex: ctx.patientSex,
    initialComplaint: ctx.initialComplaint,
    triageSummary: ctx.triageSummary,
    history: ctx.history ?? [],
    latestMessage: ctx.latestMessage ?? "",
    phase: ctx.phase,
  });

  const validationCtx: ReplyValidationContext = {
    latestMessage: ctx.latestMessage,
    initialComplaint: ctx.initialComplaint,
    history: ctx.history,
  };
  const phase = resolveConsultationInterviewPhase(validationCtx);

  const system = buildDoctorSystemPrompt({
    doctorName,
    unitName,
    doctorSpecialty: ctx.doctorSpecialty,
    honorific,
    isFollowUp,
  });

  let lastResult: DoctorAgentResult | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? prompt
        : `${prompt}\n\nKOREKSI: ${
            phase === "closing"
              ? "Pasien sudah cukup — impresi/anjuran tanpa tanda tanya."
              : phase === "assessment"
                ? "Berikan impresi hati-hati + anjuran, jangan tanya ulang."
                : "Acknowledge jawaban pasien + satu pertanyaan SOAL baru."
          }`;

    const res = await fetch(`${OLLAMA_HOST.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      throw new Error(`Ollama dokter error (${res.status})`);
    }

    const data = (await res.json()) as { message?: { content?: string }; error?: string };
    if (data.error) throw new Error(data.error);

    lastResult = parseDoctorOllamaResponse(data.message?.content ?? "", isFollowUp);
    if (!lastResult.patientText.trim()) continue;

    if (!getReplyValidationIssue(lastResult.patientText, validationCtx)) {
      return {
        ...lastResult,
        meta: {
          orchestratorProfile: "ollama-local",
          orchestratorModel: OLLAMA_MODEL,
          medgemmaModel: OLLAMA_MODEL,
          stack: "ollama-fallback",
        },
      };
    }
  }

  return {
    patientText: buildSoftAssessmentReply({
      honorific: ctx.patientHonorific,
      history: ctx.history,
      latestMessage: ctx.latestMessage,
      initialComplaint: ctx.initialComplaint,
    }),
    riskLevel: "low",
    clinicalNote: "",
    shouldEscalate: false,
    meta: {
      orchestratorProfile: "soft-assessment",
      orchestratorModel: OLLAMA_MODEL,
      medgemmaModel: OLLAMA_MODEL,
      stack: "soft-assessment-fallback",
    },
  };
}
