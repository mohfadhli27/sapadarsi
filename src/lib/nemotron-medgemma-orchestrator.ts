import { queryMedGemmaClinicalBrief, type MedGemmaClinicalBrief } from "@/src/lib/medgemma-client";
import type { DoctorAgentContext, DoctorAgentResult } from "@/src/lib/doctor-agent";
import { extractPatientFirstName } from "@/src/lib/patient-address";
import { isLikelyOutOfScopeConsultation } from "@/src/lib/consultation-redirect";
import {
  doctorConversationStyleRules,
  sanitizeDoctorReplyText,
} from "@/src/lib/doctor-consultation-format";
import {
  INTERVIEW_SOAL_RULES,
  interviewSoalInstruction,
} from "@/src/lib/consultation-interview-rules";
import {
  clinicalReplyExamples,
} from "@/src/lib/clinical-conversation-style";
import {
  analyzeInterviewFacts,
  formatKnownFactsSummary,
  isPatientClosingMessage,
} from "@/src/lib/agent-reply-validator";
import { shouldRunMedGemmaBrief } from "@/src/lib/clinical-brief-policy";
import { runValidatedOrchestratorTurn } from "@/src/lib/orchestrator-llm-turn";
import { buildClosingWarmReply, formatInterviewPhaseBlock, resolveConsultationInterviewPhase } from "@/src/lib/interview-phase";

function patientAddressLabel(ctx: DoctorAgentContext): string {
  return ctx.patientHonorific ?? "Bapak/Ibu";
}

function patientAddressStyleHint(ctx: DoctorAgentContext): string {
  const full = patientAddressLabel(ctx);
  const isFollowUp = hasPriorConversation(ctx);
  return [
    `Sapaan "${full}" — pakai MAKSIMAL sekali per pesan (hanya di awal jika perlu).`,
    'Setelah itu pakai "Anda" — jangan ulang "Ibu", "Bu", atau "Pak" di tiap kalimat.',
    'Hindari frasa aneh tanpa subjek (mis. jangan "bawa diri" — pakai "Anda ke dokter...").',
    "Nada hangat seperti chat dokter RS, tidak kaku.",
    doctorConversationStyleRules(isFollowUp),
  ].join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Perbaiki frasa yang terdengar tidak natural setelah sanitasi. */
function fixAwkwardPhrasing(text: string): string {
  let out = text;
  out = out.replace(/\bSebaiknya bawa diri ke\b/gi, "Sebaiknya Anda ke");
  out = out.replace(/\bSebaiknya bawa diri\b/gi, "Sebaiknya Anda");
  out = out.replace(/\bbawa diri ke\b/gi, "Anda konsultasikan ke");
  out = out.replace(/\bbawa diri\b/gi, "Anda");
  out = out.replace(/\bminum putih\b/gi, "minum air putih");
  out = out.replace(/\bminum putih banyak\b/gi, "minum air putih cukup");
  return out;
}

/** Kurangi sapaan berulang di kalimat ke-2 dan seterusnya. */
function reduceHonorificRepetition(text: string, ctx: DoctorAgentContext): string {
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

function hasPriorConversation(ctx: DoctorAgentContext): boolean {
  return Boolean(ctx.history?.some((m) => m.role === "doctor" || m.role === "coordinator"));
}

function isLikelyOutOfScopeQuestion(ctx: DoctorAgentContext): boolean {
  return isLikelyOutOfScopeConsultation({
    latestMessage: ctx.latestMessage ?? "",
    initialComplaint: ctx.initialComplaint,
    doctorSpecialty: ctx.doctorSpecialty,
    unitName: ctx.unitName,
    history: ctx.history,
  });
}

function newConsultationRedirectHint(ctx: DoctorAgentContext): string | null {
  const s = ctx.suggestNewConsultation;
  if (!s) return null;
  if (ctx.isRepeatedRedirect) {
    return [
      `Pasien menanyakan lagi hal yang sama (${s.label}).`,
      `Jawab SINGKAT (maks 2 kalimat): arahkan ke KONSULTASI BARU di DARSI.`,
      `Sebut keluhan yang akan diajukan: "${s.complaint}".`,
      `Arahkan klik tombol "Ajukan konsultasi baru" di bawah pesan ini — sistem akan bantu ke ${s.unitHint}.`,
      "Jangan ulang penjelasan medis panjang.",
    ].join(" ");
  }
  return [
    `Keluhan pasien (${s.label}) di luar spesialisasi Anda.`,
    `Mohon maaf dan jelaskan singkat, lalu bantu ajukan KONSULTASI BARU di DARSI.`,
    `Keluhan untuk sesi baru: "${s.complaint}" — akan diarahkan ke ${s.unitHint}.`,
    `Minta pasien klik tombol "Ajukan konsultasi baru" di bawah pesan.`,
    "Jangan suruh telepon poli atau aplikasi lain — gunakan alur DARSI.",
  ].join(" ");
}

function softenPatientAddress(text: string, ctx: DoctorAgentContext): string {
  let out = text;
  const full = patientAddressLabel(ctx);
  const firstName = extractPatientFirstName(ctx.patientName);

  if (firstName) {
    const fn = escapeRegExp(firstName);
    out = out.replace(new RegExp(`^Ibu(?!\\s+${fn})\\b`, "i"), `Ibu ${firstName}`);
    out = out.replace(new RegExp(`^Bapak(?!\\s+${fn})\\b`, "i"), `Bapak ${firstName}`);
    out = out.replace(new RegExp(`^Mohon maaf,?\\s+Ibu(?!\\s+${fn})\\b`, "i"), `Mohon maaf, Ibu ${firstName}`);
    out = out.replace(new RegExp(`,\\s*${fn}\\b`, "i"), `, ${full}`);
    out = out.replace(new RegExp(`^${fn}[,\\s]`, "i"), `${full}, `);
  }

  out = reduceHonorificRepetition(out, ctx);
  return fixAwkwardPhrasing(out);
}

function sanitizePatientText(text: string, ctx: DoctorAgentContext): string {
  const isFollowUp = hasPriorConversation(ctx);
  let out = sanitizeDoctorReplyText(text, isFollowUp);

  if (ctx.phase === "consultation" && isFollowUp) {
    out = out.replace(/^(halo|hai|selamat\s+(pagi|siang|sore|malam))[^.!?\n]*[.!?]\s*/i, "");
  }

  out = softenPatientAddress(out, ctx);

  if (ctx.phase === "consultation" && isLikelyOutOfScopeQuestion(ctx)) {
    if (/^tentu\s+boleh/i.test(out)) {
      const specialty = ctx.doctorSpecialty ?? ctx.unitName ?? "poli ini";
      out = out.replace(
        /^tentu\s+boleh[^.]*[.,]?\s*/i,
        `Mohon maaf ${patientAddressLabel(ctx)}, untuk konsultasi tersebut di luar layanan saya sebagai dokter ${specialty}. `
      );
    } else if (!/^mohon\s+maaf/i.test(out)) {
      const specialty = ctx.doctorSpecialty ?? ctx.unitName ?? "poli ini";
      out = `Mohon maaf ${patientAddressLabel(ctx)}, untuk konsultasi tersebut di luar layanan saya sebagai dokter ${specialty}. ${out}`;
    }
  }

  return out.trim();
}

function buildMedicalQuery(ctx: DoctorAgentContext): string {
  const parts = [
    ctx.initialComplaint ? `Keluhan awal: ${ctx.initialComplaint}` : "",
    ctx.latestMessage ? `Pesan terbaru: ${ctx.latestMessage}` : "",
    ctx.triageSummary ? `Triase: ${ctx.triageSummary}` : "",
    ctx.history?.length
      ? `Riwayat:\n${ctx.history.map((h) => `${h.role}: ${h.text}`).join("\n")}`
      : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

function buildNemotronOrchestratorSystem(ctx: DoctorAgentContext): string {
  const doctorName = ctx.doctorName ?? "Dokter";
  const unitName = ctx.unitName ?? "Poli";

  if (ctx.phase === "triage") {
    return [
      "Anda ORCHESTRATOR UTAMA (Nemotron) untuk konsultasi dokter DARSI.",
      "Anda akan menerima brief klinis dari modul MedGemma (INTERNAL).",
      "Tugas Anda: susun pesan untuk PASIEN sebagai Koordinator Poli RSI Surabaya A. Yani.",
      "Bahasa natural, sopan, singkat (maks 3 kalimat) — BUKAN chatbot.",
      "DILARANG menyebut AI, Nemotron, MedGemma, model, atau sistem otomatis.",
      "Jangan sebut kode ICD ke pasien pada fase ini.",
      `Panggil pasien "${patientAddressLabel(ctx)}" — WAJIB gelar + nama depan, bukan nama depan saja.`,
      patientAddressStyleHint(ctx),
      "Sapaan 'Halo' boleh sekali di awal saja, lalu langsung ke poin.",
      ctx.recommendedUnitName
        ? `WAJIB merekomendasikan poli: ${ctx.recommendedUnitName} — jangan sebut poli lain.`
        : "Ajak pasien memilih dokter dari daftar yang ditampilkan UI.",
      "",
      'Output HANYA JSON: {"patientText":"...","riskLevel":"low|medium|high","clinicalNote":"...","shouldEscalate":false}',
    ].join("\n");
  }

  if (ctx.phase === "greeting") {
    return [
      "Anda ORCHESTRATOR untuk sapaan pembuka konsultasi dokter DARSI.",
      `Persona: ${ctx.doctorName ?? "Dokter"}, ${ctx.unitName ?? "Poli"}, RSI Surabaya A. Yani.`,
      `Panggil pasien "${patientAddressLabel(ctx)}" — WAJIB gelar + nama depan (mis. "Ibu Dewi"), bukan "Dewi" saja.`,
      patientAddressStyleHint(ctx),
      INTERVIEW_SOAL_RULES,
      interviewSoalInstruction({ opening: true }),
      `Tulis SATU sapaan singkat (mis. "Halo, ${patientAddressLabel(ctx)}"), lalu tanggapi keluhan dan ajukan SATU pertanyaan SOAL.`,
      "Maksimal 2–4 kalimat. DILARANG daftar poin/bullet. DILARANG perkenalan diri panjang — pasien sudah melihat nama dokter.",
      "DILARANG menyebut AI/bot.",
      "",
      'Output HANYA JSON: {"patientText":"...","riskLevel":"low|medium|high","clinicalNote":"...","shouldEscalate":false}',
    ].join("\n");
  }

  return [
    "Anda ORCHESTRATOR UTAMA (Nemotron) untuk konsultasi dokter DARSI.",
    `Persona: ${doctorName}, dokter ${unitName}, RSI Surabaya A. Yani.`,
    `Spesialisasi dokter: ${ctx.doctorSpecialty ?? unitName}.`,
    `Panggil pasien "${patientAddressLabel(ctx)}" — maksimal sekali di awal pesan.`,
    patientAddressStyleHint(ctx),
    "Jika pertanyaan di LUAR spesialisasi dokter, awali dengan sopan: \"Mohon maaf...\" — JANGAN kata \"Tentu boleh\".",
    newConsultationRedirectHint(ctx) ?? "Arahkan ke poli/dokter yang sesuai atau IGD jika darurat.",
    INTERVIEW_SOAL_RULES,
    "Riwayat chat adalah konteks sesi — lanjutkan dari pesan terakhir, jangan mengulang dari awal.",
    clinicalReplyExamples("doctor"),
    "PENTING — tentukan fase: GATHERING (tanya 1 SOAL), FOLLOW_UP (jawab pertanyaan pasien), ASSESSMENT (impresi awal hati-hati + anjuran), CLOSING (tanpa pertanyaan).",
    "Jika pasien BERTANYA (apakah/bagaimana) — WAJIB jawab langsung, jangan abaikan dengan template generik.",
    "Jika pasien bilang 'sudah cukup/hanya itu/tidak ada' → ASSESSMENT atau CLOSING, BUKAN tanya lagi topik sama.",
    "Impresi/diagnosis: gunakan 'kemungkinan/sejalan dengan', JANGAN diagnosis pasti atau over-confident.",
    "DILARANG mengulang 'Halo', perkenalan diri, atau ringkasan panjang keluhan jika sudah ada riwayat.",
    "DILARANG daftar poin/bullet/angka untuk wawancara — maksimal SATU pertanyaan SOAL per balasan.",
    "Jangan tanya ulang informasi yang sudah dijawab pasien di riwayat chat.",
    "Gunakan PERTANYAAN SOAL SUGGEST dari brief MedGemma jika relevan — parafrase natural.",
    "Brief klinis MedGemma (INTERNAL) — untuk akurasi, jangan copy mentah ke pasien.",
    "DILARANG menyebut AI/bot/Nemotron/MedGemma.",
    "DILARANG menyalin, mengutip, atau mengulang verbatim pesan/keluhan pasien — WAJIB balas sebagai dokter dengan jawaban/pertanyaan SOAL Anda sendiri.",
    "DILARANG frasa 'Baik, berarti sudah [kutipan pesan pasien]' — rangkum singkat dengan kata Anda sendiri.",
    "Tidak diagnosis final atau resep obat keras tanpa konteks cukup.",
    hasPriorConversation(ctx)
      ? "PESAN LANJUTAN: maks 2–4 kalimat singkat. Jawab langsung pertanyaan pasien. Jika pasien bilang terima kasih, balas 1 kalimat penutup saja."
      : "Pesan pertama live: sapaan singkat + tanggapan keluhan, maks 3 kalimat.",
    "",
    'Output HANYA JSON: {"patientText":"...","riskLevel":"low|medium|high","clinicalNote":"ringkasan internal","shouldEscalate":false}',
  ].join("\n");
}

function buildNemotronUserPrompt(
  ctx: DoctorAgentContext,
  clinicalBrief: string,
  medgemmaUsed: boolean
): string {
  const lines: string[] = [];

  if (medgemmaUsed && clinicalBrief.trim()) {
    lines.push(
      "=== BRIEF KLINIS MEDGEMMA (INTERNAL, jangan kutip mentah ke pasien) ===",
      clinicalBrief,
      "Gunakan PERTANYAAN SOAL SUGGEST dari brief untuk satu pertanyaan ke pasien (parafrase natural)."
    );
  }

  lines.push(
    "=== KONTEKS SESI ===",
    `Panggilan pasien (jika perlu): ${patientAddressLabel(ctx)} — maksimal sekali per pesan`,
    ctx.patientAge != null ? `Usia pasien: ${ctx.patientAge} tahun` : "",
    ctx.patientSex ? `Jenis kelamin: ${ctx.patientSex === "L" ? "Laki-laki" : ctx.patientSex === "P" ? "Perempuan" : ctx.patientSex}` : "",
    ctx.doctorName ? `Dokter: ${ctx.doctorName}` : "",
    ctx.unitName ? `Poli: ${ctx.unitName}` : "",
    ctx.doctorSpecialty ? `Spesialisasi: ${ctx.doctorSpecialty}` : "",
    ctx.recommendedUnitName ? `Poli yang ditampilkan di UI: ${ctx.recommendedUnitName}` : "",
    ctx.initialComplaint ? `Keluhan awal: ${ctx.initialComplaint}` : "",
    ctx.triageSummary ? `Ringkasan triase: ${ctx.triageSummary}` : ""
  );

  const facts = analyzeInterviewFacts({
    history: ctx.history,
    latestMessage: ctx.latestMessage,
    initialComplaint: ctx.initialComplaint,
  });
  lines.push(
    "=== FAKTA YANG SUDAH DIKETAHUI (jangan tanya ulang) ===",
    formatKnownFactsSummary(facts)
  );

  if (ctx.history?.length) {
    lines.push(
      "Riwayat chat (knowledge base — ikuti versi terbaru jika ada koreksi dokter):",
      "=== RIWAYAT CHAT LENGKAP SESI (WAJIB dibaca — jangan kontradiksi atau mengulang pertanyaan yang sudah dijawab) ===",
      ...ctx.history.map((m) => {
        const who =
          m.role === "patient" ? "Pasien" : m.role === "doctor" ? "Dokter" : "Koordinator";
        return `${who}: ${m.text}`;
      })
    );
  }

  if (ctx.latestMessage) lines.push(`Pesan baru pasien: ${ctx.latestMessage}`);

  if (ctx.phase === "greeting") {
    lines.push(`Instruksi: ${interviewSoalInstruction({ opening: true })}`);
  } else if (ctx.phase === "consultation") {
    lines.push(
      formatInterviewPhaseBlock({
        history: ctx.history,
        latestMessage: ctx.latestMessage,
        initialComplaint: ctx.initialComplaint,
      })
    );
    if (hasPriorConversation(ctx)) {
      lines.push(
        "Jangan buka dengan 'Terima kasih atas informasinya' berulang. Acknowledge spesifik jawaban terbaru pasien."
      );
    }
  }

  if (ctx.phase === "consultation" && ctx.suggestNewConsultation) {
    const hint = newConsultationRedirectHint(ctx);
    if (hint) lines.push(`Instruksi PENTING: ${hint}`);
  } else if (ctx.phase === "consultation" && isLikelyOutOfScopeQuestion(ctx)) {
    lines.push(
      "Instruksi PENTING: pertanyaan pasien di luar spesialisasi Anda. Awali dengan mohon maaf dan tolak dengan sopan — JANGAN \"Tentu boleh\"."
    );
  }

  return lines.filter(Boolean).join("\n");
}

function parseOrchestratorJson(raw: string, ctx: DoctorAgentContext): DoctorAgentResult {
  const empty: DoctorAgentResult = {
    patientText: "",
    riskLevel: "low",
    clinicalNote: "",
    shouldEscalate: false,
  };

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ...empty, patientText: sanitizePatientText(raw.trim(), ctx) };
  }
  try {
    const p = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const rawText = String(p.patientText ?? p.reply ?? "").trim();
    return {
      patientText: sanitizePatientText(rawText, ctx),
      riskLevel: (p.riskLevel as DoctorAgentResult["riskLevel"]) ?? "low",
      clinicalNote: String(p.clinicalNote ?? p.recommendation ?? ""),
      shouldEscalate: Boolean(p.shouldEscalate),
    };
  } catch {
    return { ...empty, patientText: sanitizePatientText(raw.trim(), ctx) };
  }
}

export type OrchestratedDoctorResult = DoctorAgentResult & {
  meta: {
    orchestratorProfile: string;
    orchestratorModel: string;
    medgemmaModel: string;
    stack: "nemotron+medgemma";
  };
};

/**
 * Alur: MedGemma (analisis klinis) → Nemotron (orchestrator + jawaban pasien)
 */
export async function runNemotronMedGemmaDoctorAgent(
  ctx: DoctorAgentContext
): Promise<OrchestratedDoctorResult> {
  const useMedGemma = shouldRunMedGemmaBrief({
    phase: ctx.phase,
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
      console.warn("[nemotron+medgemma] MedGemma gagal, orchestrator tanpa brief", error);
      clinical.answer = "";
    }
  } else {
    console.info("[nemotron+medgemma] MedGemma dilewati — turn ringan/penutup");
  }

  const validationCtx = {
    latestMessage: ctx.latestMessage,
    initialComplaint: ctx.initialComplaint,
    history: ctx.history,
  };

  const facts = analyzeInterviewFacts(validationCtx);
  const interviewPhase = resolveConsultationInterviewPhase(validationCtx);
  const isClosing =
    interviewPhase === "closing" || isPatientClosingMessage(ctx.latestMessage) || facts.patientClosing;

  let parsed: DoctorAgentResult;
  let model: string;
  let profileId: string;
  let attempts: number;

  try {
    const llmResult = await runValidatedOrchestratorTurn({
      validationCtx,
      system: buildNemotronOrchestratorSystem(ctx),
      buildUser: (correction) =>
        `${buildNemotronUserPrompt(ctx, clinical.answer, useMedGemma)}${correction}`,
      extractReply: (raw) => parseOrchestratorJson(raw, ctx),
      getReplyText: (r) => r.patientText,
      maxAttempts: isClosing ? 2 : interviewPhase === "follow_up" ? 3 : 2,
    });
    parsed = llmResult.result;
    model = llmResult.model;
    profileId = llmResult.profileId;
    attempts = llmResult.attempts;
  } catch (error) {
    if (isClosing) {
      const warmReply = buildClosingWarmReply({
        honorific: ctx.patientHonorific,
        initialComplaint: ctx.initialComplaint,
        history: ctx.history,
      });
      return {
        patientText: warmReply,
        riskLevel: "low",
        clinicalNote: "",
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
    console.info(`[nemotron+medgemma] respons valid setelah ${attempts} percobaan LLM`);
  }

  if (clinical.riskLevel === "high" && parsed.riskLevel === "low") {
    parsed.riskLevel = "high";
    parsed.shouldEscalate = true;
  } else if (clinical.riskLevel === "medium" && parsed.riskLevel === "low") {
    parsed.riskLevel = "medium";
  }
  if (clinical.shouldEscalate) parsed.shouldEscalate = true;

  if (!parsed.clinicalNote && clinical.answer) {
    parsed.clinicalNote = clinical.answer.slice(0, 500);
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
