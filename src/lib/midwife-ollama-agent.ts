/**
 * Fallback bidan via Ollama lokal — selaras dengan alur dokter (fase wawancara + validasi).
 */

import { z } from "zod";
import type { MidwifeAgentContext, MidwifeAgentResult } from "@/src/lib/midwife-agent";
import {
  buildMidwifeSystemPromptForAgent,
  buildMidwifeUserPromptFromContext,
  sanitizeMidwifeReplyText,
} from "@/src/lib/midwife-consultation-format";
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
  process.env.OLLAMA_MIDWIFE_MODEL?.trim() ||
  process.env.OLLAMA_DOCTOR_MODEL?.trim() ||
  process.env.OLLAMA_ORCHESTRATOR_MODEL?.trim() ||
  "llama3.1:8b";

const midwifeResponseSchema = z.object({
  reply: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  recommendation: z.string().optional().default(""),
  shouldEscalate: z.boolean().optional().default(false),
});

function parseMidwifeOllamaResponse(raw: string): MidwifeAgentResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      reply: sanitizeMidwifeReplyText(raw.trim()),
      riskLevel: "low",
      recommendation: "",
      shouldEscalate: false,
    };
  }

  try {
    const parsed = midwifeResponseSchema.parse(JSON.parse(jsonMatch[0]));
    return {
      reply: sanitizeMidwifeReplyText(parsed.reply),
      riskLevel: parsed.riskLevel,
      recommendation: parsed.recommendation ?? "",
      shouldEscalate: parsed.shouldEscalate ?? false,
    };
  } catch {
    return {
      reply: sanitizeMidwifeReplyText(raw.trim()),
      riskLevel: "low",
      recommendation: "",
      shouldEscalate: false,
    };
  }
}

function correctionSuffix(phase: ReturnType<typeof resolveConsultationInterviewPhase>): string {
  if (phase === "closing") {
    return "KOREKSI: Pasien sudah cukup — ringkas pemahaman spesifik + anjuran singkat tanpa tanda tanya.";
  }
  if (phase === "follow_up") {
    return "KOREKSI: Jawab pertanyaan pasien secara spesifik (sebut detail keluhan dari riwayat) — bukan template umum.";
  }
  if (phase === "assessment") {
    return "KOREKSI: Impresi awal dengan fakta spesifik pasien + anjuran praktis relevan. Jangan template generik.";
  }
  return "KOREKSI: Acknowledge fakta pasien, sebut detail spesifik, lalu tepat satu pertanyaan SOAL — gaya bidan natural.";
}

export async function runMidwifeOllamaAgent(ctx: MidwifeAgentContext): Promise<MidwifeAgentResult> {
  const validationCtx: ReplyValidationContext = {
    latestMessage: ctx.latestMessage,
    initialComplaint: ctx.initialComplaint,
    history: ctx.history,
  };
  const phase = resolveConsultationInterviewPhase(validationCtx);
  const prompt = buildMidwifeUserPromptFromContext(ctx);
  const system = buildMidwifeSystemPromptForAgent(ctx);

  let lastResult: MidwifeAgentResult | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0 ? prompt : `${prompt}\n\n${correctionSuffix(phase)}`;

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
      throw new Error(`Ollama bidan error (${res.status})`);
    }

    const data = (await res.json()) as { message?: { content?: string }; error?: string };
    if (data.error) throw new Error(data.error);

    lastResult = parseMidwifeOllamaResponse(data.message?.content ?? "");
    if (!lastResult.reply.trim()) continue;

    if (!getReplyValidationIssue(lastResult.reply, validationCtx)) {
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

  const softReply = buildSoftAssessmentReply({
    honorific: ctx.patientHonorific,
    history: ctx.history,
    latestMessage: ctx.latestMessage,
    initialComplaint: ctx.initialComplaint,
  });

  return {
    reply: softReply,
    riskLevel: "low",
    recommendation: "",
    shouldEscalate: false,
    meta: {
      orchestratorProfile: "soft-assessment",
      orchestratorModel: OLLAMA_MODEL,
      medgemmaModel: "n/a",
      stack: "soft-assessment-fallback",
    },
  };
}
