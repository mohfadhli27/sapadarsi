/**
 * Validasi respons agent — tanpa mengganti dengan template.
 * Jika tidak valid, orchestrator WAJIB retry LLM.
 */

import {
  isPatientFollowUpQuestion,
  isRepeatOfPriorClinicianReply,
  type ThreadTurn,
} from "@/src/lib/interview-context";
import {
  formatCoveredTopicsSummary,
  resolveConsultationInterviewPhase,
} from "@/src/lib/interview-phase";
import { isVagueClinicalReply } from "@/src/lib/clinical-conversation-style";

function normalizeCompareText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_TEMPLATE_PATTERNS = [
  /terima kasih sudah menghubungi saya/,
  /bisa dijelaskan lebih detail keluhannya/,
  /pesan anda sudah kami terima/,
  /dokter akan segera merespons/,
  /tim bidan kami akan membantu menilai/,
  /terima kasih sudah menjelaskan keluhan anda.*tim bidan/,
  /kemungkinan perlu diperhatikan dan dievaluasi lebih lanjut.*segera ke faskes jika gejala memburuk/,
];

export type ReplyValidationContext = {
  latestMessage?: string;
  initialComplaint?: string | null;
  history?: Array<{ role: string; text: string }>;
};

export function isGenericTemplateReply(text: string): boolean {
  const n = normalizeCompareText(text);
  if (!n) return true;
  return GENERIC_TEMPLATE_PATTERNS.some((p) => p.test(n));
}

function patientTextsFromContext(input: ReplyValidationContext): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (text: string | undefined | null) => {
    const trimmed = text?.trim();
    if (!trimmed) return;
    const key = normalizeCompareText(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };
  for (const h of input.history ?? []) {
    if (h.role === "patient") push(h.text);
  }
  push(input.latestMessage);
  return out;
}

function stripChatVocatives(text: string): string {
  return text.replace(/\b(dok|dokter|bu bidan|bidan|perawat|bu|pak)\b/gi, " ");
}

function extractBerartiQuote(normalizedReply: string): string | null {
  const m = normalizedReply.match(/berarti\s+(?:sudah\s+)?(.+?)(?:[.?]\s|$)/);
  if (!m?.[1] || m[1].length < 12) return null;
  return m[1].trim();
}

export function isEchoOfPatientReply(reply: string, input: ReplyValidationContext): boolean {
  const normalizedReply = normalizeCompareText(stripChatVocatives(reply));
  if (!normalizedReply || normalizedReply.length < 2) return false;

  for (const patientText of patientTextsFromContext(input)) {
    const normalizedPatient = normalizeCompareText(stripChatVocatives(patientText));
    if (!normalizedPatient) continue;
    if (normalizedReply === normalizedPatient) return true;

    // Kutipan panjang verbatim dari pesan pasien di dalam balasan
    if (normalizedPatient.length >= 12 && normalizedReply.includes(normalizedPatient)) {
      return true;
    }

    // "Baik, berarti sudah [kutipan hampir penuh pesan pasien]"
    const quoted = extractBerartiQuote(normalizedReply);
    if (quoted && normalizedPatient.length >= 12) {
      if (normalizedPatient.includes(quoted) || quoted.includes(normalizedPatient)) {
        return true;
      }
      const qWords = quoted.split(" ").filter((w) => w.length > 3);
      const pWords = normalizedPatient.split(" ").filter((w) => w.length > 3);
      if (qWords.length >= 4 && pWords.length >= 4) {
        const matched = qWords.filter((w) => pWords.includes(w)).length;
        if (matched / Math.min(qWords.length, pWords.length) >= 0.85) return true;
      }
    }

    if (
      normalizedPatient.length >= 8 &&
      normalizedReply.length <= normalizedPatient.length * 1.15 &&
      normalizedPatient.length / normalizedReply.length >= 0.85
    ) {
      return true;
    }
  }
  return false;
}

export type ReplyValidationIssue =
  | "empty"
  | "generic_template"
  | "too_vague"
  | "echo_patient"
  | "repeat_clinician"
  | "question_after_closing"
  | "repeat_topic"
  | "ignored_patient_question";

function isRepeatTopicQuestion(
  reply: string,
  ctx: ReplyValidationContext
): boolean {
  if (!reply.includes("?")) return false;
  const covered = formatCoveredTopicsSummary(ctx).toLowerCase();
  const r = reply.toLowerCase();

  if (/tidur|istirahat|insomnia|begadang/.test(r) && /tidur|istirahat/.test(covered)) {
    return true;
  }
  if (/stres|emosional|overthinking|tekanan|cemas|pola makan/.test(r) && /stres|tidur|makan/.test(covered)) {
    return true;
  }
  if (/riwayat|serupa|sebelumnya|pernah mengalami/.test(r) && /riwayat/.test(covered)) {
    return true;
  }
  if (/faktor|memicu|selain|pemicu/.test(r) && /faktor pemicu/.test(covered)) {
    return true;
  }
  return false;
}

/** Respons penutup generik saat pasien baru bertanya — ditolak agar LLM retry. */
function ignoresPatientFollowUpQuestion(reply: string, ctx: ReplyValidationContext): boolean {
  if (!isPatientFollowUpQuestion(ctx.latestMessage)) return false;
  const r = reply.toLowerCase();
  const q = (ctx.latestMessage ?? "").toLowerCase();
  const genericClosing =
    /kemungkinan perlu diperhatikan dan dievaluasi lebih lanjut/.test(r) ||
    /pantau keluhan.*segera ke faskes/.test(r);
  if (!genericClosing) return false;
  if (/makan|makanan|diet|nutrisi/.test(q)) {
    return !/makan|makanan|nutrisi|diet|folat|vitamin/.test(r);
  }
  if (/obat|vitamin|suplemen/.test(q)) {
    return !/obat|vitamin|suplemen|paracetamol/.test(r);
  }
  return genericClosing && r.length < 220;
}

export function getReplyValidationIssue(
  reply: string,
  ctx: ReplyValidationContext
): ReplyValidationIssue | null {
  const trimmed = reply.trim();
  if (!trimmed) return "empty";
  if (isGenericTemplateReply(trimmed)) return "generic_template";
  if (isVagueClinicalReply(trimmed)) return "too_vague";
  if (isEchoOfPatientReply(trimmed, ctx)) return "echo_patient";
  if (isRepeatOfPriorClinicianReply(trimmed, (ctx.history ?? []) as ThreadTurn[])) {
    return "repeat_clinician";
  }

  const phase = resolveConsultationInterviewPhase(ctx);
  if (phase === "closing") {
    if (trimmed.includes("?")) return "question_after_closing";
    if (trimmed.length > 150) return "question_after_closing";
  }
  if (isRepeatTopicQuestion(trimmed, ctx)) {
    return "repeat_topic";
  }
  if (ignoresPatientFollowUpQuestion(trimmed, ctx)) {
    return "ignored_patient_question";
  }

  return null;
}

export function assertValidAgentReply(reply: string, ctx: ReplyValidationContext): void {
  const issue = getReplyValidationIssue(reply, ctx);
  if (issue) {
    throw new Error(`Respons AI tidak valid (${issue})`);
  }
}

export function buildLlmCorrectionPrompt(
  issue: ReplyValidationIssue,
  rejectedReply: string,
  knownFactsSummary: string
): string {
  const reasons: Record<ReplyValidationIssue, string> = {
    empty: "Respons kosong.",
    generic_template:
      "Respons terlalu generik seperti template — WAJIB spesifik ke keluhan dan jawaban pasien di riwayat.",
    too_vague:
      "Respons terlalu umum/tidak spesifik — WAJIB sebut detail keluhan pasien (lokasi, lama, intensitas, kehamilan) dan jawab konkret seperti tenaga medis RS.",
    echo_patient: "JANGAN menyalin atau mengulang verbatim pesan pasien.",
    repeat_clinician:
      "JANGAN mengulang pertanyaan yang sudah Anda tanyakan — acknowledge jawaban pasien lalu lanjutkan.",
    question_after_closing:
      "Pasien sudah ucapkan terima kasih — balas HANYA 1–2 kalimat penutup hangat singkat (maks 20 kata). Sebut keluhan terkini, TANPA pertanyaan, TANPA rangkuman panjang.",
    repeat_topic:
      "JANGAN tanya ulang topik yang sudah dijawab pasien (stres, tidur, riwayat, faktor pemicu). Berikan impresi awal hati-hati + anjuran.",
    ignored_patient_question:
      "Pasien mengajukan PERTANYAAN — WAJIB jawab langsung (contoh: soal makanan, obat). JANGAN balas template penutup generik yang mengabaikan pertanyaan.",
  };

  const tail =
    issue === "question_after_closing"
      ? "Tulis ulang patientText: HANYA 1–2 kalimat penutup hangat singkat (contoh: 'Sama-sama Ibu, semoga sakit kepalanya cepat membaik ya.'). TANPA pertanyaan, TANPA rangkuman keluhan."
      : issue === "repeat_topic"
        ? "Tulis ulang patientText: impresi awal hati-hati + anjuran praktis, tanpa mengulang pertanyaan topik yang sama."
        : issue === "ignored_patient_question"
          ? "Tulis ulang patientText: jawab pertanyaan pasien secara spesifik dan natural, lalu anjuran singkat jika perlu."
          : issue === "too_vague"
            ? "Tulis ulang patientText: sebut minimal 1 detail spesifik dari keluhan pasien, berikan penjelasan/anjuran relevan — bukan template umum."
            : "Tulis ulang patientText: bahasa natural dokter/bidan, acknowledge singkat, lanjutkan sesuai fase konsultasi.";

  return [
    "",
    "=== KOREKSI (respons sebelumnya DITOLAK — tulis ulang) ===",
    reasons[issue],
    rejectedReply ? `Respons ditolak: "${rejectedReply.slice(0, 280)}"` : "",
    "",
    "=== FAKTA YANG SUDAH DIKETAHUI (jangan tanya ulang) ===",
    knownFactsSummary,
    "",
    tail,
  ]
    .filter(Boolean)
    .join("\n");
}

export { analyzeInterviewFacts, formatKnownFactsSummary } from "@/src/lib/interview-context";
export { isPatientClosingMessage } from "@/src/lib/interview-context";
