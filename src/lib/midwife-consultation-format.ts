import { resolvePatientHonorific } from "@/src/lib/patient-address";
import { INTERVIEW_SOAL_RULES, interviewSoalInstruction } from "@/src/lib/consultation-interview-rules";
import {
  clinicalConversationStyleRules,
  clinicalReplyExamples,
} from "@/src/lib/clinical-conversation-style";
import { formatInterviewPhaseBlock } from "@/src/lib/interview-phase";
import type { MidwifeAgentContext } from "@/src/lib/midwife-agent";

const STAFF_DISPLAY_NAME = "Tim Bidan RSI";

/** Nama tampilan untuk pasien — selalu praktisi sesi jika sudah dipilih. */
export function resolveMidwifeSenderForPatient(
  msg: { sender_type: string; staff_actor?: string | null },
  practitionerName?: string | null
): string | undefined {
  if (msg.sender_type === "patient" || msg.sender_type === "system") return undefined;
  if (msg.sender_type === "agent") return "Koordinator Bidan";
  const assigned = practitionerName?.trim();
  if (assigned) return assigned;
  if (msg.staff_actor?.trim()) return msg.staff_actor.trim();
  return STAFF_DISPLAY_NAME;
}

export type MidwifeAiPayload = {
  reply: string;
  riskLevel: "low" | "medium" | "high";
  recommendation: string;
  shouldEscalate: boolean;
};

/** Prompt sistem khusus konsultasi bidan — jawaban rapi untuk pasien. */
export function buildMidwifeSystemPrompt(honorific: string, isFollowUp = false) {
  const lines = [
    "Anda adalah asisten konsultasi awal bidan RS Islam Surabaya A. Yani (DARSI).",
    "Percakapan dipantau perawat/bidan RSI. Bantu pasien dengan aman, ringkas, dan empatik.",
    "",
    "ATURAN WAJIB:",
    `- Panggil pasien: ${honorific} — maksimal sekali di awal pesan, jangan di setiap kalimat.`,
    honorific.startsWith("Bapak")
      ? "- Pasien LAKI-LAKI — WAJIB gunakan Bapak, JANGAN Ibu/Bu."
      : honorific.startsWith("Ibu")
        ? "- Pasien PEREMPUAN — WAJIB gunakan Ibu, JANGAN Bapak/Pak."
        : "",
    "- JANGAN perkenalkan diri sebagai 'A. Yani', nama rumah sakit, atau nama bot.",
    "- JANGAN sebut 'RSI Surabaya' di awal kalimat perkenalan; cukup 'tim bidan DARSI' jika perlu.",
    "- Bahasa Indonesia natural seperti chat perawat/bidan, tidak kaku atau seperti template.",
    "- Maksimal 2–4 kalimat singkat per balasan.",
    INTERVIEW_SOAL_RULES,
    "- Tidak diagnosis pasti, tidak resep obat keras, tidak dosis obat.",
    "- Jika ada tanda bahaya (perdarahan hebat, demam tinggi, sesak, kejang, tidak sadar): shouldEscalate true.",
    "- reply: hanya teks untuk pasien, tanpa markdown, tanpa JSON, tanpa bullet berlebihan.",
    "- recommendation: 1 kalimat saran praktis singkat (bukan salinan reply).",
    "- Variasikan struktur kalimat — jangan mengulang pola pembuka yang sama.",
  ];

  if (isFollowUp) {
    lines.push(
      "",
      "INI PESAN LANJUTAN (bukan pertama):",
      "- JANGAN ulangi Assalamualaikum, salam pembuka, atau perkenalan tim bidan.",
      "- JANGAN ringkas ulang seluruh keluhan awal kecuali pasien bertanya hal baru.",
      "- Jawab langsung pertanyaan/keluhan terbaru pasien berdasarkan riwayat di bawah.",
      "- Boleh pakai 'Anda' jika lebih natural setelah sapaan pertama."
    );
  }

  lines.push(
    "",
    "Balas HANYA JSON valid tanpa markdown:",
    '{"reply":"...","riskLevel":"low|medium|high","recommendation":"...","shouldEscalate":true|false}'
  );

  return lines.join("\n");
}

function mapMidwifeHistoryForPrompt(
  history: Array<{ role: string; text: string }>
): string {
  return history
    .map((m) => {
      if (m.role === "patient") return `Pasien: ${m.text}`;
      if (m.role === "coordinator") return `Koordinator: ${m.text}`;
      return `Bidan: ${m.text}`;
    })
    .join("\n");
}

/** Prompt sistem untuk agent bidan (Nemotron + Ollama fallback). */
export function buildMidwifeSystemPromptForAgent(ctx: MidwifeAgentContext): string {
  const honorific = ctx.patientHonorific ?? "Bapak/Ibu";
  const isFollowUp = Boolean(
    ctx.history?.some((m) => m.role === "midwife" || m.role === "coordinator")
  );
  const practitioner = ctx.practitionerName ?? "Bidan RSI";

  return [
    `Anda ${practitioner}, bidan/perawat RSI Surabaya A. Yani.`,
    `Panggil pasien "${honorific}" — maksimal sekali di awal pesan.`,
    honorific.startsWith("Bapak")
      ? "Pasien laki-laki — gunakan Bapak, jangan Ibu."
      : honorific.startsWith("Ibu")
        ? "Pasien perempuan — gunakan Ibu, jangan Bapak."
        : "",
    "Nada hangat natural seperti bidan berchat — bukan template 'Tim bidan akan membantu menilai'.",
    clinicalConversationStyleRules("midwife", isFollowUp),
    clinicalReplyExamples("midwife"),
    "WAJIB balas dari sudut pandang BIDAN — jangan salin verbatim pesan pasien.",
    "Tentukan fase: GATHERING / FOLLOW_UP / ASSESSMENT / CLOSING.",
    "Jika pasien tanya 'jadi gimana?' → berikan impresi awal + anjuran, bukan template kosong.",
    INTERVIEW_SOAL_RULES,
    isFollowUp
      ? "PESAN LANJUTAN: jangan ulang Assalamualaikum/perkenalan. Acknowledge spesifik jawaban terbaru."
      : "",
    "Tidak diagnosis pasti, tidak resep obat keras.",
    "",
    'Balas HANYA JSON: {"reply":"...","riskLevel":"low|medium|high","recommendation":"...","shouldEscalate":false}',
  ]
    .filter(Boolean)
    .join("\n");
}

/** Prompt user untuk agent bidan — dengan fase wawancara seperti dokter. */
export function buildMidwifeUserPromptFromContext(ctx: MidwifeAgentContext): string {
  const parts = [
    `Panggilan pasien: ${ctx.patientHonorific ?? "Bapak/Ibu"}`,
    ctx.patientSex === "L"
      ? "Jenis kelamin: Laki-laki"
      : ctx.patientSex === "P"
        ? "Jenis kelamin: Perempuan"
        : "",
    ctx.practitionerName ? `Bidan/perawat: ${ctx.practitionerName}` : "",
    ctx.initialComplaint ? `Keluhan awal: ${ctx.initialComplaint}` : "",
    ctx.history?.length
      ? `Percakapan sesi:\n${mapMidwifeHistoryForPrompt(ctx.history)}`
      : "",
    ctx.latestMessage ? `Pesan terbaru pasien: ${ctx.latestMessage}` : "",
  ];

  if (ctx.phase === "greeting" || ctx.openingLive) {
    parts.push(
      interviewSoalInstruction({ opening: true }),
      "Pembuka live: sapa hangat, tanggapi keluhan, ajukan TEPAT SATU pertanyaan SOAL."
    );
  } else {
    parts.push(
      formatInterviewPhaseBlock({
        history: ctx.history,
        latestMessage: ctx.latestMessage,
        initialComplaint: ctx.initialComplaint,
      })
    );
  }

  return parts.filter(Boolean).join("\n\n");
}

export function formatMidwifeHistoryLine(msg: {
  sender_type: string;
  message_text: string;
  edited_text?: string | null;
}): string {
  const text = effectiveChatMessageText(msg.message_text, msg.edited_text);
  if (!text) return "";
  if (msg.sender_type === "patient") return `Pasien: ${text}`;
  if (msg.sender_type === "agent") return `Koordinator: ${text}`;
  if (msg.sender_type === "staff") return `Bidan/Perawat: ${text}`;
  if (msg.sender_type === "system") return `Sistem: ${text}`;
  return `Bidan: ${text}`;
}

export function buildMidwifeUserPrompt(input: {
  patientName: string;
  noRm: string;
  honorific: string;
  patientSex?: string | null;
  initialComplaint?: string | null;
  history: Array<{ sender_type: string; message_text: string }>;
  latestMessage: string;
  priorThreadContext?: string;
  practitionerName?: string | null;
  openingLive?: boolean;
}) {
  const historyText = input.history
    .map((m) => formatMidwifeHistoryLine(m))
    .filter(Boolean)
    .join("\n");

  const isFollowUp = input.openingLive
    ? false
    : input.history.some((m) => m.sender_type === "ai" || m.sender_type === "staff") ||
      Boolean(input.priorThreadContext?.trim());

  const parts = [
    `Panggilan pasien (WAJIB dipakai): ${input.honorific}`,
    input.patientSex === "L"
      ? "Jenis kelamin pasien: Laki-laki — JANGAN panggil Ibu."
      : input.patientSex === "P"
        ? "Jenis kelamin pasien: Perempuan — JANGAN panggil Bapak."
        : "",
    `Pasien: ${input.patientName} (${input.noRm})`,
    input.practitionerName ? `Bidan/perawat: ${input.practitionerName}` : "",
    input.initialComplaint ? `Keluhan awal sesi ini: ${input.initialComplaint}` : "",
    input.priorThreadContext?.trim()
      ? `Ringkasan konsultasi sebelumnya dengan bidan ini:\n${input.priorThreadContext}`
      : "",
    historyText ? `Percakapan sesi ini:\n${historyText}` : "",
    `Pesan/keluhan yang perlu ditanggapi: ${input.latestMessage}`,
  ];

  if (input.openingLive) {
    parts.push(
      "Konsultasi live BARU disetujui bidan/perawat.",
      "Sambut singkat, tanggapi keluhan dari riwayat, lalu ajukan TEPAT SATU pertanyaan SOAL (mis. kapan mulai, berapa lama, intensitas).",
      "JANGAN minta pasien menceritakan ulang dari nol jika keluhan sudah jelas di riwayat."
    );
  } else if (isFollowUp) {
    parts.push(
      "Balas sebagai lanjutan percakapan — acknowledge singkat pesan terbaru, lalu SATU pertanyaan SOAL berikutnya.",
      "Jangan template pembuka. Jangan mengarang gejala yang tidak disebut pasien."
    );
  } else {
    parts.push("Ini awal konsultasi — sambut singkat, tanggapi keluhan, ajukan SATU pertanyaan SOAL.");
  }

  return { prompt: parts.filter(Boolean).join("\n\n"), isFollowUp };
}

/** Bersihkan artefak model dari teks mentah. */
export function sanitizeMidwifeReplyText(text: string): string {
  let out = text.trim();

  // Buang JSON bocor
  if (out.startsWith("{") && (out.includes('"reply"') || out.includes('"patientText"'))) {
    try {
      const parsed = JSON.parse(out) as { reply?: string; patientText?: string };
      if (parsed.reply) out = parsed.reply;
      else if (parsed.patientText) out = parsed.patientText;
    } catch {
      const m = out.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m?.[1]) out = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  }

  out = out
    .replace(/^(Selamat\s+(pagi|siang|sore|malam),?\s*)?Saya\s+A\.?\s*Yani[^.]*\.\s*/gi, "")
    .replace(/Saya\s+(adalah\s+)?bidan\s+dari\s+RSI\s+Surabaya[^.]*\.\s*/gi, "")
    .replace(/RS\s*Islam\s+Surabaya\s*A\.?\s*Yani\s*[-–]?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}

/** Format tampilan pasien (markdown ringan). */
export function formatMidwifePatientReply(response: MidwifeAiPayload): string {
  const reply = sanitizeMidwifeReplyText(response.reply);
  const rec = response.recommendation?.trim() ?? "";

  const parts: string[] = [reply];

  if (rec && rec.length > 0 && rec !== reply && !reply.includes(rec)) {
    parts.push(`\n\n**Saran:** ${rec}`);
  }

  if (response.riskLevel === "high") {
    parts.push(
      "\n\n⚠️ **Perhatian:** Gejala berisiko tinggi. Segera ke IGD RSI Surabaya A. Yani atau faskes terdekat."
    );
  } else if (response.riskLevel === "medium") {
    parts.push(
      "\n\n_Jika keluhan memburuk atau muncul tanda bahaya, segera ke faskes terdekat._"
    );
  }

  return parts.join("");
}

/** Koreksi sapaan AI yang salah (mis. "Ibu Budi" untuk pasien laki-laki). */
export function fixMidwifePatientAddress(text: string, honorific: string): string {
  const firstName = honorific.replace(/^(Bapak|Ibu|Adik|Bapak\/Ibu)\s+/i, "").trim();
  if (!firstName) return text;

  const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = text;

  if (/^Bapak\s/i.test(honorific)) {
    out = out.replace(new RegExp(`\\bIbu\\s+${escaped}\\b`, "gi"), honorific);
    out = out.replace(
      new RegExp(`(Halo|Hai|Selamat\\s+\\w+),?\\s+Ibu(?=\\s|,|$)`, "gi"),
      `$1, ${honorific.split(" ")[0]}`
    );
  } else if (/^Ibu\s/i.test(honorific)) {
    out = out.replace(new RegExp(`\\bBapak\\s+${escaped}\\b`, "gi"), honorific);
  }

  return out;
}

export function resolveMidwifeHonorific(patient: {
  nama?: string | null;
  sex?: string | null;
  tgl_lahir?: string | null;
}) {
  return resolvePatientHonorific({
    name: patient.nama,
    sex: patient.sex,
    birthDate: patient.tgl_lahir,
  });
}

export function midwifeStaffDisplayName() {
  return STAFF_DISPLAY_NAME;
}

export type MidwifePatientMessage = {
  id: number;
  role: "user" | "assistant" | "system" | "coordinator" | "doctor";
  content: string;
  senderName?: string;
  createdAt: string;
};

export type MidwifeThreadMessageRole = MidwifePatientMessage["role"];

export function mapMidwifeThreadMessage(
  msg: {
    id: number;
    sender_type: string;
    message_text: string;
    staff_actor?: string | null;
    created_at: Date;
  },
  practitionerName?: string | null
): MidwifePatientMessage {
  if (msg.sender_type === "patient") {
    return {
      id: msg.id,
      role: "user",
      content: msg.message_text,
      createdAt: msg.created_at.toISOString(),
    };
  }
  if (msg.sender_type === "system") {
    return {
      id: msg.id,
      role: "system",
      content: msg.message_text,
      createdAt: msg.created_at.toISOString(),
    };
  }
  if (msg.sender_type === "agent") {
    return {
      id: msg.id,
      role: "coordinator",
      content: msg.message_text,
      senderName: "Koordinator Bidan",
      createdAt: msg.created_at.toISOString(),
    };
  }
  if (msg.sender_type === "staff") {
    return {
      id: msg.id,
      role: "doctor",
      content: sanitizeMidwifeReplyText(msg.message_text),
      senderName: resolveMidwifeSenderForPatient(msg, practitionerName) ?? STAFF_DISPLAY_NAME,
      createdAt: msg.created_at.toISOString(),
    };
  }
  return {
    id: msg.id,
    role: "assistant",
    content: sanitizeMidwifeReplyText(msg.message_text),
    senderName: resolveMidwifeSenderForPatient(msg, practitionerName) ?? STAFF_DISPLAY_NAME,
    createdAt: msg.created_at.toISOString(),
  };
}

export function effectiveChatMessageText(
  messageText: string | null | undefined,
  editedText?: string | null
): string {
  const edited = editedText?.trim();
  if (edited) return edited;
  return (messageText ?? "").trim();
}

export function mapMidwifeRowToPatientMessage(
  row: {
    id: number;
    sender_type: string;
    message_text: string | null;
    edited_text?: string | null;
    staff_actor?: string | null;
    created_at: Date;
  },
  practitionerName?: string | null
): MidwifePatientMessage {
  const mapped = mapMidwifeThreadMessage(
    {
      id: row.id,
      sender_type: row.sender_type,
      message_text: effectiveChatMessageText(row.message_text, row.edited_text),
      staff_actor: row.staff_actor,
      created_at: row.created_at,
    },
    practitionerName
  );

  if (mapped.role === "coordinator") {
    return {
      id: mapped.id,
      role: "assistant",
      content: mapped.content,
      senderName: mapped.senderName,
      createdAt: mapped.createdAt,
    };
  }

  return mapped;
}

export function mapMidwifeRowToVisibleMessage(
  row: {
    id: number;
    sender_type: string;
    message_text: string | null;
    edited_text?: string | null;
    staff_actor?: string | null;
    is_takeover?: boolean | null;
    created_at: Date;
  },
  practitionerName?: string | null
): {
  id: number;
  role: MidwifePatientMessage["role"];
  text: string;
  senderName?: string;
  createdAt: Date;
  isTakeover: boolean;
} {
  const mapped = mapMidwifeRowToPatientMessage(row, practitionerName);
  return {
    id: mapped.id,
    role: mapped.role,
    text: mapped.content,
    senderName: mapped.senderName,
    createdAt: new Date(mapped.createdAt),
    isTakeover: Boolean(row.is_takeover),
  };
}

export function mapMidwifeMessageForPatient(msg: {
  id: number;
  sender_type: string;
  message_text: string;
  edited_text?: string | null;
  staff_actor?: string | null;
  created_at: Date;
}): MidwifePatientMessage {
  return mapMidwifeRowToPatientMessage(msg);
}
