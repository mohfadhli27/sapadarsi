import { queryMedGemmaClinicalBrief, type MedGemmaClinicalBrief } from "@/src/lib/medgemma-client";
import type { MidwifeAgentContext, MidwifeAgentResult } from "@/src/lib/midwife-agent";
import { extractPatientFirstName } from "@/src/lib/patient-address";
import {
  INTERVIEW_SOAL_RULES,
  interviewSoalInstruction,
} from "@/src/lib/consultation-interview-rules";
import {
  clinicalConversationStyleRules,
  clinicalReplyExamples,
  formatPatientContextAnchorBlock,
} from "@/src/lib/clinical-conversation-style";
import {
  analyzeInterviewFacts,
  formatKnownFactsSummary,
} from "@/src/lib/agent-reply-validator";
import { shouldRunMedGemmaBrief } from "@/src/lib/clinical-brief-policy";
import { runValidatedOrchestratorTurn } from "@/src/lib/orchestrator-llm-turn";
import {
  buildClosingWarmReply,
  formatInterviewPhaseBlock,
  resolveConsultationInterviewPhase,
} from "@/src/lib/interview-phase";
import {
  fixMidwifePatientAddress,
  sanitizeMidwifeReplyText,
} from "@/src/lib/midwife-consultation-format";

function patientAddressLabel(ctx: MidwifeAgentContext): string {
  return ctx.patientHonorific ?? "Bapak/Ibu";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPriorConversation(ctx: MidwifeAgentContext): boolean {
  return Boolean(ctx.history?.some((m) => m.role === "midwife" || m.role === "coordinator"));
}

function reduceHonorificRepetition(text: string, ctx: MidwifeAgentContext): string {
  const full = patientAddressLabel(ctx);
  const firstName = extractPatientFirstName(ctx.patientName);
  const vocatives = [
    full,
    firstName ? `Ibu ${firstName}` : null,
    firstName ? `Bapak ${firstName}` : null,
    "Ibu",
    "Bapak",
    "Bu",
    "Pak",
  ].filter((v): v is string => Boolean(v));

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) return text;

  return sentences
    .map((sentence, index) => {
      if (index === 0) return sentence;
      let cleaned = sentence;
      for (const vocative of vocatives) {
        const v = escapeRegExp(vocative);
        cleaned = cleaned.replace(new RegExp(`^${v}[,\\s]+`, "i"), "");
        cleaned = cleaned.replace(new RegExp(`,\\s*${v}\\b`, "gi"), "");
        cleaned = cleaned.replace(new RegExp(`\\b${v}\\b[,\\s]*`, "gi"), "");
      }
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      return cleaned.trim();
    })
    .filter(Boolean)
    .join(" ");
}

function sanitizePatientText(text: string, ctx: MidwifeAgentContext): string {
  const isFollowUp = hasPriorConversation(ctx);
  let out = sanitizeMidwifeReplyText(text);

  if (ctx.phase === "consultation" && isFollowUp) {
    out = out.replace(/^(halo|hai|selamat\s+(pagi|siang|sore|malam))[^.!?\n]*[.!?]\s*/i, "");
    out = out.replace(/^(assalamualaikum|assalamu'alaikum)[^.!?\n]*[.!?]\s*/i, "");
  }

  out = fixMidwifePatientAddress(out, patientAddressLabel(ctx));
  out = reduceHonorificRepetition(out, ctx);

  return out.trim();
}

function buildMedicalQuery(ctx: MidwifeAgentContext): string {
  const parts = [
    "Konteks: konsultasi bidan/perawat (bukan dokter spesialis).",
    ctx.initialComplaint ? `Keluhan awal: ${ctx.initialComplaint}` : "",
    ctx.latestMessage ? `Pesan terbaru: ${ctx.latestMessage}` : "",
    ctx.history?.length
      ? `Riwayat:\n${ctx.history.map((h) => `${h.role}: ${h.text}`).join("\n")}`
      : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

function buildNemotronSystem(ctx: MidwifeAgentContext): string {
  const practitioner = ctx.practitionerName ?? "Tim Bidan RSI";

  if (ctx.phase === "greeting" || ctx.openingLive) {
    return [
      "Anda ORCHESTRATOR untuk konsultasi bidan/perawat DARSI.",
      `Persona: ${practitioner}, RSI Surabaya A. Yani.`,
      `Panggil pasien "${patientAddressLabel(ctx)}" — maksimal sekali di awal.`,
      INTERVIEW_SOAL_RULES,
      clinicalConversationStyleRules("midwife", false),
      clinicalReplyExamples("midwife"),
      interviewSoalInstruction({ opening: true }),
      "DILARANG diagnosis pasti, resep obat keras, atau menyebut AI/bot.",
      "DILARANG menyalin, mengutip, atau mengulang verbatim pesan/keluhan pasien — WAJIB balas dengan pertanyaan SOAL Anda sendiri.",
    "DILARANG frasa 'Baik, berarti sudah [kutipan pesan pasien]' — rangkum dengan kata Anda sendiri (contoh: 'berarti Ibu cenderung banyak beristirahat').",
      "Maksimal 2–4 kalimat. DILARANG bullet/daftar angka.",
      "",
      'Output HANYA JSON: {"patientText":"...","riskLevel":"low|medium|high","clinicalNote":"...","shouldEscalate":false}',
    ].join("\n");
  }

  const isFollowUp = hasPriorConversation(ctx);

  return [
    "Anda ORCHESTRATOR untuk konsultasi bidan/perawat DARSI.",
    `Persona: ${practitioner}, RSI Surabaya A. Yani.`,
    `Panggil pasien "${patientAddressLabel(ctx)}" — maksimal sekali di awal pesan.`,
    INTERVIEW_SOAL_RULES,
    clinicalConversationStyleRules("midwife", isFollowUp),
    clinicalReplyExamples("midwife"),
    "Riwayat chat adalah konteks sesi — lanjutkan dari pesan terakhir, jangan mengulang dari awal.",
    "Jika pasien BERTANYA (apakah/bagaimana/bisa) — WAJIB jawab pertanyaan tersebut secara langsung, jangan abaikan dengan template penutup generik.",
    "Tentukan fase: GATHERING / FOLLOW_UP / ASSESSMENT / CLOSING — lanjutkan wawancara SOAL sampai data cukup.",
    "Jika pasien tanya 'jadi gimana?' → berikan impresi awal + anjuran praktis, bukan template kosong.",
    "DILARANG mengulang salam pembuka atau perkenalan tim bidan jika sudah ada riwayat.",
    "Brief klinis MedGemma (INTERNAL) — jangan kutip mentah; gunakan untuk akurasi pertanyaan SOAL.",
    "DILARANG diagnosis pasti atau resep obat keras.",
    "DILARANG menyebut AI/bot/Nemotron/MedGemma.",
  ].join("\n");
}

function buildNemotronUserPrompt(
  ctx: MidwifeAgentContext,
  clinicalBrief: string,
  medgemmaUsed: boolean
): string {
  const lines: string[] = [];

  if (medgemmaUsed && clinicalBrief.trim()) {
    lines.push(
      "=== BRIEF KLINIS MEDGEMMA (INTERNAL) ===",
      clinicalBrief,
      "Gunakan PERTANYAAN SOAL SUGGEST dari brief jika ada — parafrase natural ke pasien."
    );
  }

  lines.push(
    "=== KONTEKS SESI ===",
    `Panggilan pasien: ${patientAddressLabel(ctx)}`,
    ctx.patientAge != null ? `Usia: ${ctx.patientAge} tahun` : "",
    ctx.patientSex
      ? `Jenis kelamin: ${ctx.patientSex === "L" ? "Laki-laki" : ctx.patientSex === "P" ? "Perempuan" : ctx.patientSex}`
      : "",
    ctx.practitionerName ? `Bidan/perawat: ${ctx.practitionerName}` : "",
    ctx.initialComplaint ? `Keluhan awal: ${ctx.initialComplaint}` : ""
  );

  if (ctx.history?.length) {
    const facts = analyzeInterviewFacts({
      history: ctx.history,
      latestMessage: ctx.latestMessage,
      initialComplaint: ctx.initialComplaint,
    });
    lines.push(
      "=== FAKTA YANG SUDAH DIKETAHUI (jangan tanya ulang) ===",
      formatKnownFactsSummary(facts),
      "=== RIWAYAT CHAT LENGKAP SESI (WAJIB dibaca — jangan kontradiksi atau mengulang pertanyaan yang sudah dijawab) ===",
      ...ctx.history.map((m) => {
        const who =
          m.role === "patient" ? "Pasien" : m.role === "midwife" ? "Bidan" : "Koordinator";
        return `${who}: ${m.text}`;
      })
    );
  }

  if (ctx.latestMessage) lines.push(`Pesan baru pasien: ${ctx.latestMessage}`);

  if (ctx.phase === "greeting" || ctx.openingLive) {
    lines.push(formatPatientContextAnchorBlock({
      history: ctx.history,
      latestMessage: ctx.latestMessage,
      initialComplaint: ctx.initialComplaint,
    }));
    lines.push(`Instruksi: ${interviewSoalInstruction({ opening: true })}`);
  } else {
    lines.push(
      formatInterviewPhaseBlock({
        history: ctx.history,
        latestMessage: ctx.latestMessage,
        initialComplaint: ctx.initialComplaint,
      })
    );
  }

  return lines.filter(Boolean).join("\n");
}

function parseOrchestratorJson(raw: string, ctx: MidwifeAgentContext): MidwifeAgentResult {
  const empty: MidwifeAgentResult = {
    reply: "",
    riskLevel: "low",
    recommendation: "",
    shouldEscalate: false,
  };

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ...empty, reply: sanitizePatientText(raw.trim(), ctx) };
  }
  try {
    const p = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const rawText = String(p.patientText ?? p.reply ?? "").trim();
    return {
      reply: sanitizePatientText(rawText, ctx),
      riskLevel: (p.riskLevel as MidwifeAgentResult["riskLevel"]) ?? "low",
      recommendation: String(p.clinicalNote ?? p.recommendation ?? ""),
      shouldEscalate: Boolean(p.shouldEscalate),
    };
  } catch {
    return { ...empty, reply: sanitizePatientText(raw.trim(), ctx) };
  }
}

export type OrchestratedMidwifeResult = MidwifeAgentResult & {
  meta: {
    orchestratorProfile: string;
    orchestratorModel: string;
    medgemmaModel: string;
    stack: "nemotron+medgemma";
  };
};

export async function runNemotronMedGemmaMidwifeAgent(
  ctx: MidwifeAgentContext
): Promise<OrchestratedMidwifeResult> {
  const useMedGemma = shouldRunMedGemmaBrief({
    phase: ctx.phase === "greeting" ? "greeting" : "consultation",
    openingLive: ctx.openingLive,
    latestMessage: ctx.latestMessage,
    hasPriorClinicianReply: hasPriorConversation(ctx),
    history: ctx.history,
    initialComplaint: ctx.initialComplaint,
  });

  let clinical: MedGemmaClinicalBrief = {
    answer: "",
    model: "skipped",
    riskLevel: "low",
    shouldEscalate: false,
  };

  if (useMedGemma) {
    try {
      clinical = await queryMedGemmaClinicalBrief(buildMedicalQuery(ctx));
    } catch (error) {
      console.warn("[midwife nemotron+medgemma] MedGemma gagal", error);
      clinical.answer = "";
    }
  } else {
    console.info("[midwife nemotron+medgemma] MedGemma dilewati — turn ringan/penutup");
  }

  const validationCtx = {
    latestMessage: ctx.latestMessage,
    initialComplaint: ctx.initialComplaint,
    history: ctx.history,
  };

  const interviewPhase = resolveConsultationInterviewPhase(validationCtx);
  const isClosing = interviewPhase === "closing";

  let parsed: MidwifeAgentResult;
  let model: string;
  let profileId: string;
  let attempts: number;

  try {
    const llmResult = await runValidatedOrchestratorTurn({
      validationCtx,
      system: buildNemotronSystem(ctx),
      buildUser: (correction) =>
        `${buildNemotronUserPrompt(ctx, clinical.answer, useMedGemma)}${correction}`,
      extractReply: (raw) => parseOrchestratorJson(raw, ctx),
      getReplyText: (r) => r.reply,
      maxAttempts: isClosing ? 2 : interviewPhase === "follow_up" ? 3 : 2,
    });
    parsed = llmResult.result;
    model = llmResult.model;
    profileId = llmResult.profileId;
    attempts = llmResult.attempts;
  } catch (error) {
    // LLM gagal validasi → fallback penutup hangat saat closing, atau throw
    if (isClosing) {
      const warmReply = buildClosingWarmReply({
        honorific: ctx.patientHonorific,
        initialComplaint: ctx.initialComplaint,
        history: ctx.history,
      });
      return {
        reply: warmReply,
        riskLevel: "low",
        recommendation: "",
        shouldEscalate: false,
        meta: {
          orchestratorProfile: "closing-fallback",
          orchestratorModel: "n/a",
          medgemmaModel: clinical.model,
          stack: "nemotron+medgemma",
        },
      };
    }
    throw error;
  }

  if (attempts > 1) {
    console.info(`[midwife nemotron+medgemma] respons valid setelah ${attempts} percobaan LLM`);
  }

  if (clinical.riskLevel === "high" && parsed.riskLevel === "low") {
    parsed.riskLevel = "high";
    parsed.shouldEscalate = true;
  } else if (clinical.riskLevel === "medium" && parsed.riskLevel === "low") {
    parsed.riskLevel = "medium";
  }
  if (clinical.shouldEscalate) parsed.shouldEscalate = true;

  if (!parsed.recommendation && clinical.answer) {
    parsed.recommendation = clinical.answer.slice(0, 500);
  }

  return {
    ...parsed,
    meta: {
      orchestratorProfile: profileId,
      orchestratorModel: model,
      medgemmaModel: clinical.model,
      stack: "nemotron+medgemma",
    },
  };
}
