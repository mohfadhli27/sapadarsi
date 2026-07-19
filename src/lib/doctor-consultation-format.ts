/**
 * Format & sanitasi jawaban konsultasi dokter untuk pasien.
 */

import {
  INTERVIEW_SOAL_RULES,
  interviewSoalInstruction,
} from "@/src/lib/consultation-interview-rules";
import {
  clinicalConversationStyleRules,
  clinicalReplyExamples,
} from "@/src/lib/clinical-conversation-style";
import { formatInterviewPhaseBlock } from "@/src/lib/interview-phase";

const AI_CLOSING_PATTERNS = [
  /\s*Selalu siap membantu\.?\s*/gi,
  /\s*Apakah ada pertanyaan lain\??\s*/gi,
  /\s*Jangan ragu untuk menghubungi[^.]*\.?\s*/gi,
  /\s*tinggal kirim (ya|saja)\.?\.?\s*/gi,
  /\s*Silakan hubungi kembali jika[^.]*\.?\s*/gi,
];

const ENGLISH_TO_ID: Array<[RegExp, string]> = [
  [/\blebih\s+likely\b/gi, "kemungkinan besar"],
  [/\bmost\s+likely\b/gi, "kemungkinan besar"],
  [/\blikely\b/gi, "kemungkinan"],
  [/\bunlikely\b/gi, "kurang mungkin"],
  [/\bfocus\s+on\b/gi, "fokus pada"],
  [/\bfocus\b/gi, "fokus"],
  [/\btension\s+ringan\b/gi, "tekanan ringan"],
  [/\bnormal\s+range\b/gi, "rentang normal"],
];

/** Bersihkan frasa kaku / campuran bahasa / template AI. */
export function sanitizeDoctorReplyText(text: string, isFollowUp = false): string {
  let out = text.trim();

  if (out.startsWith("{") && (out.includes('"patientText"') || out.includes('"reply"'))) {
    try {
      const parsed = JSON.parse(out) as { patientText?: string; reply?: string };
      if (parsed.patientText) out = parsed.patientText;
      else if (parsed.reply) out = parsed.reply;
    } catch {
      const m = out.match(/"patientText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m?.[1]) out = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  }

  for (const [pattern, replacement] of ENGLISH_TO_ID) {
    out = out.replace(pattern, replacement);
  }

  for (const pattern of AI_CLOSING_PATTERNS) {
    out = out.replace(pattern, " ");
  }

  if (isFollowUp) {
    out = out.replace(/^Terima kasih atas informasinya[^.!?]*[.!?]\s*/i, "");
    out = out.replace(/^Terima kasih sudah (menjelaskan|memberikan)[^.!?]*[.!?]\s*/i, "");
  }

  out = out
    .replace(/\b(Nemotron|MedGemma|AI|chatbot|bot)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}

/** Petunjuk gaya bahasa untuk orchestrator dokter. */
export function doctorConversationStyleRules(isFollowUp: boolean): string {
  return clinicalConversationStyleRules("doctor", isFollowUp);
}

export function formatDoctorHistoryLine(msg: {
  role: string;
  text: string;
}): string {
  if (msg.role === "patient") return `Pasien: ${msg.text}`;
  if (msg.role === "coordinator") return `Koordinator: ${msg.text}`;
  return `Dokter: ${msg.text}`;
}

/** Prompt sistem untuk fallback Ollama/MedGemma (alur lama yang natural & cepat). */
export function buildDoctorSystemPrompt(input: {
  doctorName: string;
  unitName: string;
  doctorSpecialty?: string;
  honorific: string;
  isFollowUp: boolean;
}): string {
  const specialty = input.doctorSpecialty ?? input.unitName;
  return [
    `Anda ${input.doctorName}, dokter ${specialty}, RSI Surabaya A. Yani.`,
    `Panggil pasien "${input.honorific}" — maksimal sekali di awal pesan.`,
    input.honorific.startsWith("Bapak")
      ? "Pasien laki-laki — gunakan Bapak, jangan Ibu."
      : input.honorific.startsWith("Ibu")
        ? "Pasien perempuan — gunakan Ibu, jangan Bapak."
        : "",
    "Nada hangat dan empatik seperti dokter berchat dengan pasien, bukan robot atau template.",
    "WAJIB balas dari sudut pandang DOKTER — jangan salin/mengulang verbatim pesan pasien.",
    "Jangan mulai dengan 'Saya pusing/sakit' — itu perspektif pasien. Gunakan 'Baik, berarti...' atau tanya lanjutan.",
    INTERVIEW_SOAL_RULES,
    doctorConversationStyleRules(input.isFollowUp),
    clinicalReplyExamples("doctor"),
    "Tidak diagnosis final atau resep obat keras tanpa konteks cukup.",
    "",
    'Balas HANYA JSON valid tanpa markdown:',
    '{"patientText":"...","riskLevel":"low|medium|high","clinicalNote":"...","shouldEscalate":false}',
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDoctorUserPrompt(input: {
  doctorName: string;
  unitName: string;
  doctorSpecialty?: string;
  honorific: string;
  patientSex?: string | null;
  initialComplaint?: string | null;
  triageSummary?: string | null;
  history: Array<{ role: string; text: string }>;
  latestMessage: string;
  phase: "triage" | "greeting" | "consultation";
}): { prompt: string; isFollowUp: boolean } {
  const historyText = input.history.map(formatDoctorHistoryLine).filter(Boolean).join("\n");
  const isFollowUp = input.history.some(
    (m) => m.role === "doctor" || m.role === "coordinator"
  );

  const parts = [
    `Panggilan pasien: ${input.honorific}`,
    input.patientSex === "L"
      ? "Jenis kelamin: Laki-laki"
      : input.patientSex === "P"
        ? "Jenis kelamin: Perempuan"
        : "",
    `Dokter: ${input.doctorName} (${input.unitName})`,
    input.doctorSpecialty ? `Spesialisasi: ${input.doctorSpecialty}` : "",
    input.initialComplaint ? `Keluhan awal sesi: ${input.initialComplaint}` : "",
    input.triageSummary ? `Ringkasan triase: ${input.triageSummary}` : "",
    historyText ? `Percakapan sesi ini:\n${historyText}` : "",
    `Pesan/keluhan terbaru pasien: ${input.latestMessage}`,
  ];

  if (input.phase === "greeting") {
    parts.push(
      interviewSoalInstruction({ opening: true }),
      "Pembuka konsultasi live: sapa hangat, tanggapi keluhan dari riwayat, ajukan TEPAT SATU pertanyaan SOAL.",
      "Jangan minta pasien menceritakan ulang dari nol jika keluhan sudah jelas."
    );
  } else if (input.phase === "consultation") {
    parts.push(
      formatInterviewPhaseBlock({
        history: input.history,
        latestMessage: input.latestMessage,
        initialComplaint: input.initialComplaint,
      })
    );
  } else if (isFollowUp) {
    parts.push(
      interviewSoalInstruction(),
      "Acknowledge singkat jawaban pasien, lalu ajukan SATU pertanyaan SOAL berikutnya yang belum terjawab."
    );
  } else {
    parts.push(interviewSoalInstruction({ opening: true }));
  }

  return { prompt: parts.filter(Boolean).join("\n\n"), isFollowUp };
}
