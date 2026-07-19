/**
 * Fase wawancara konsultasi — kapan tanya, kapan impresi awal, kapan tutup.
 */

import {
  analyzeInterviewFacts,
  isPatientClosingMessage,
  isPatientFollowUpQuestion,
  type InterviewFacts,
} from "@/src/lib/interview-context";
import { interviewSoalInstruction } from "@/src/lib/consultation-interview-rules";
import { formatPatientContextAnchorBlock } from "@/src/lib/clinical-conversation-style";
import { buildNextInterviewReply } from "@/src/lib/interview-context";

export type ConsultationInterviewPhase = "gathering" | "follow_up" | "assessment" | "closing";

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jawaban singkat negatif / cukup — "tidak ada dok", "hanya itu". Bukan jawaban riwayat ("belum pernah"). */
export function isPatientNegativeOrDoneAnswer(text?: string | null): boolean {
  if (!text?.trim()) return false;
  if (isPatientClosingMessage(text)) return true;
  const m = norm(text.replace(/\bdok\b/g, "").replace(/\bbidan\b/g, ""));

  // Jawaban riwayat medis — lanjut wawancara, bukan penutup
  if (/^belum\s+pernah/.test(m) || /^tidak\s+pernah/.test(m)) return false;
  if (/^(ya|iya|pernah|sudah pernah)\b/.test(m)) return false;

  return (
    /^(tidak ada|nggak ada|gak ada|ga ada|tidak|tdk)(\s|$)/.test(m) ||
    /^tidak\s+(ada|kuat|parah)\b/.test(m) ||
    /^(sudah|cukup|hanya itu|itu saja|nothing)(\s|$)/.test(m) ||
    /\b(hanya itu|sudah cukup|ga ada|gak ada|tidak ada lagi)\b/.test(m)
  );
}

function clinicianTurns(history: Array<{ role: string; text: string }>) {
  return history.filter((h) =>
    ["doctor", "midwife", "coordinator"].includes(h.role)
  );
}

function allPatientText(facts: InterviewFacts, initialComplaint?: string | null): string {
  return [initialComplaint ?? "", ...facts.patientMessages].join(" ").toLowerCase();
}

function allClinicianText(facts: InterviewFacts): string {
  return facts.clinicianMessages.join(" ").toLowerCase();
}

export function resolveConsultationInterviewPhase(input: {
  history?: Array<{ role: string; text: string }>;
  latestMessage?: string;
  initialComplaint?: string | null;
}): ConsultationInterviewPhase {
  const history = input.history ?? [];
  const latest = input.latestMessage?.trim() ?? "";
  const facts = analyzeInterviewFacts(input);
  const askedCount = clinicianTurns(history).length;

  if (isPatientClosingMessage(latest) || facts.patientClosing) {
    return "closing";
  }

  if (isPatientFollowUpQuestion(latest)) {
    return "follow_up";
  }

  if (
    /^(jadi\s+)?(gimana|bagaimana|trus|lanjut|soalnya|terus)/.test(norm(latest)) &&
    askedCount >= 1
  ) {
    return "assessment";
  }

  if (isPatientNegativeOrDoneAnswer(latest) && askedCount >= 2) {
    return "assessment";
  }

  const patientBlob = allPatientText(facts, input.initialComplaint);
  const substantiveAnswers = facts.patientMessages.filter((m) => norm(m).length >= 12).length;
  const coreFacts =
    facts.onsetKnown ||
    facts.severityKnown ||
    facts.frequencyKnown ||
    facts.associatedSymptomsMentioned ||
    /overthinking|stres|cemas|tidur|demam|pusing|mual|nyeri/.test(patientBlob);

  if (askedCount >= 4 && coreFacts && substantiveAnswers >= 2) {
    return "assessment";
  }

  if (askedCount >= 5) {
    return "assessment";
  }

  return "gathering";
}

export function formatCoveredTopicsSummary(input: {
  history?: Array<{ role: string; text: string }>;
  latestMessage?: string;
  initialComplaint?: string | null;
}): string {
  const facts = analyzeInterviewFacts(input);
  const patientBlob = allPatientText(facts, input.initialComplaint);
  const clinicianBlob = allClinicianText(facts);
  const latest = input.latestMessage?.trim() ?? "";
  const lines: string[] = [];

  if (/overthinking|cemas|stres|tekanan|emosional|khawatir/.test(patientBlob)) {
    lines.push("- Stres/cemas/overthinking: SUDAH dijelaskan pasien — JANGAN tanya ulang");
  }
  if (/tidur|insomnia|kurang tidur|begadang/.test(patientBlob)) {
    lines.push("- Pola tidur: SUDAH dijelaskan pasien — JANGAN tanya tidur/istirahat lagi");
  }
  if (/makan|nafsu makan|diet/.test(patientBlob)) {
    lines.push("- Pola makan: SUDAH disebut — JANGAN tanya pola makan lagi");
  }
  if (/riwayat|pernah|serupa/.test(clinicianBlob) && isPatientNegativeOrDoneAnswer(latest)) {
    lines.push("- Riwayat penyakit serupa: pasien jawab TIDAK ADA — jangan tanya lagi");
  }
  if (/faktor|memicu|memperberat|selain/.test(clinicianBlob) && isPatientNegativeOrDoneAnswer(latest)) {
    lines.push("- Faktor pemicu tambahan: pasien jawab TIDAK ADA / sudah cukup — jangan tanya faktor lain lagi");
  }
  if (/stres|emosional|overthinking|tekanan/.test(clinicianBlob)) {
    lines.push("- Pertanyaan stres/emosional: SUDAH pernah ditanyakan dokter");
  }
  if (/riwayat|serupa|sebelumnya/.test(clinicianBlob)) {
    lines.push("- Pertanyaan riwayat serupa: SUDAH pernah ditanyakan dokter");
  }
  if (/tidur|istirahat/.test(clinicianBlob)) {
    lines.push("- Pertanyaan tidur/istirahat: SUDAH pernah ditanyakan dokter");
  }

  return lines.length ? lines.join("\n") : "- Belum ada topik yang terkunci ulang";
}

export function interviewPhaseInstruction(phase: ConsultationInterviewPhase): string {
  switch (phase) {
    case "closing":
      return [
        "FASE PENUTUP — pasien mengucapkan terima kasih / menyatakan cukup.",
        "Balas 1–2 kalimat penutup HANGAT yang natural seperti bidan/dokter sungguhan (maks 20 kata).",
        "Sebut keluhan TERKINI yang baru dibahas (bukan keluhan lama) agar terasa personal.",
        "Contoh: 'Sama-sama Ibu, semoga sakit kepalanya segera membaik ya. Jaga istirahat.'",
        "DILARANG: tanda tanya, saran medis panjang, mengulang/merangkum seluruh keluhan.",
        "DILARANG: 'saya paham bahwa Anda mengalami...' atau frasa formal panjang.",
      ].join("\n");
    case "follow_up":
      return [
        "FASE TANYA JAWAB — pasien mengajukan PERTANYAAN LANJUTAN.",
        "WAJIB jawab pertanyaan pasien LANGSUNG dengan penjelasan medis spesifik (bukan template umum).",
        "Sebut detail keluhan pasien dari riwayat agar terasa personal (contoh: 'untuk nyeri punggung di kehamilan 4 minggu...').",
        "Gaya bidan/dokter berpengalaman — empatik, konkret, seperti chat RS.",
        "BOLEH 1 pertanyaan lanjutan relevan di akhir jika membantu — DILARANG template 'istirahat cukup minum air putih' tanpa konteks.",
      ].join("\n");
    case "assessment":
      return [
        "FASE IMPRESI AWAL — data wawancara sudah cukup untuk sementara.",
        "WAJIB: rangkum 1–2 fakta spesifik pasien + impresi awal HATI-HATI dengan alasan singkat.",
        "Contoh: 'Mengingat nyeri punggung berat di usia kehamilan 4 minggu dan belum pernah dialami, kemungkinan terkait perubahan postur/ligament — ...'",
        "Anjuran praktis SPESIFIK ke kasus (posisi tidur, hindari angkat berat, kompres hangat, dll) — bukan saran generik saja.",
        "DILARANG: 'perlu diperhatikan dan dievaluasi lebih lanjut' tanpa menjelaskan kemungkinan apa.",
        "TANPA pertanyaan lanjutan kecuali tanda bahaya merah yang belum diketahui.",
      ].join("\n");
    default:
      return interviewSoalInstruction();
  }
}

export function formatInterviewPhaseBlock(input: {
  history?: Array<{ role: string; text: string }>;
  latestMessage?: string;
  initialComplaint?: string | null;
}): string {
  const phase = resolveConsultationInterviewPhase(input);
  const covered = formatCoveredTopicsSummary(input);
  const anchors = formatPatientContextAnchorBlock(input);
  return [
    `=== FASE KONSULTASI: ${phase.toUpperCase()} ===`,
    interviewPhaseInstruction(phase),
    "",
    anchors,
    "",
    "=== TOPIK YANG SUDAH DIJAWAB (DILARANG tanya ulang) ===",
    covered,
  ].join("\n");
}

/** Penutup hangat singkat — dipakai saat pasien ucapkan terima kasih / selesai. */
export function buildClosingWarmReply(input: {
  honorific?: string;
  initialComplaint?: string | null;
  history?: Array<{ role: string; text: string }>;
}): string {
  const honorific = input.honorific ?? "Bapak/Ibu";

  // Ambil keluhan dari beberapa pesan terakhir (lebih relevan daripada seluruh riwayat)
  const history = input.history ?? [];
  const recentMessages = history.slice(-6).map((h) => h.text).join(" ").toLowerCase();
  const fullBlob = [
    input.initialComplaint ?? "",
    ...history.map((h) => h.text),
  ].join(" ").toLowerCase();

  // Gunakan konteks terkini sebagai sumber utama keluhan
  const ctx = recentMessages || fullBlob;

  const symptoms: string[] = [];
  if (/sakit\s*kepala|kepala\s*sakit|pusing|vertigo|migrain/.test(ctx)) symptoms.push("sakit kepala");
  if (/mual|muntah/.test(ctx)) symptoms.push("mual");
  if (/nyeri\s*punggung|punggung\s*sakit|sakit\s*punggung/.test(ctx)) symptoms.push("nyeri punggung");
  if (/nyeri|sakit/.test(ctx) && !symptoms.length) symptoms.push("keluhan");
  if (/demam|panas/.test(ctx)) symptoms.push("demam");
  if (/batuk|pilek/.test(ctx)) symptoms.push("batuk");

  const isPregnant = /hamil|kehamilan|\d+\s*(minggu|bulan)\s*(kehamilan|hamil)?/.test(fullBlob);

  if (symptoms.length === 0) {
    if (isPregnant) {
      return `Sama-sama ${honorific}, semoga kehamilannya lancar dan sehat selalu ya.`;
    }
    return `Sama-sama ${honorific}, semoga cepat membaik ya. Jangan ragu konsultasi lagi jika ada keluhan.`;
  }

  const mainSymptom = symptoms[0];
  const wish = mainSymptom === "sakit kepala"
    ? "sakit kepalanya segera membaik"
    : mainSymptom === "mual"
      ? "mualnya cepat berkurang"
      : mainSymptom === "nyeri punggung"
        ? "nyeri punggungnya segera membaik"
        : mainSymptom === "demam"
          ? "demamnya cepat turun"
          : mainSymptom === "batuk"
            ? "batuknya segera sembuh"
            : "keluhannya segera membaik";

  if (isPregnant) {
    return `Sama-sama ${honorific}, semoga ${wish} dan kehamilannya lancar ya.`;
  }
  return `Sama-sama ${honorific}, semoga ${wish} ya.`;
}

/** Impresi awal aman dari fakta chat — dipakai hanya jika semua LLM gagal validasi. */
export function buildSoftAssessmentReply(input: {
  honorific?: string;
  history?: Array<{ role: string; text: string }>;
  latestMessage?: string;
  initialComplaint?: string | null;
}): string {
  const facts = analyzeInterviewFacts(input);
  const honorific = input.honorific ?? "Bapak/Ibu";
  const blob = allPatientText(facts, input.initialComplaint);
  const latest = (input.latestMessage ?? "").trim();
  const latestLower = latest.toLowerCase();
  const phase = resolveConsultationInterviewPhase(input);

  if (phase === "closing") {
    return buildClosingWarmReply(input);
  }

  if (phase === "gathering") {
    return buildNextInterviewReply({
      history: input.history,
      latestMessage: input.latestMessage,
      initialComplaint: input.initialComplaint,
    });
  }

  if (isPatientFollowUpQuestion(latest)) {
    if (/makan|makanan|diet|nutrisi|vitamin/.test(latestLower)) {
      if (/hamil|kehamilan|\d+\s*minggu/.test(blob)) {
        const weeks = blob.match(/\d+\s*minggu/)?.[0] ?? "awal kehamilan";
        return `${honorific}, iya — asupan bergizi penting di ${weeks}. Usahakan makan kecil tapi teratur, cukup asam folat dan zat besi, hindari makanan mentah. Untuk nyeri punggung, posisi tidur miring dengan bantal di lutut dan hindari mengangkat beban berat bisa membantu meringankan.`;
      }
      return `${honorific}, pola makan memang ikut memengaruhi kondisi tubuh. Makan teratur dan cukup air putih; hindari makanan yang memicu mual atau ketidaknyamanan sesuai keluhan Anda.`;
    }
    if (/obat|vitamin|suplemen|paracetamol|analgesik/.test(latestLower)) {
      return `${honorific}, untuk obat atau suplemen selama kehamilan sebaiknya dikonsultasikan langsung ke bidan/dokter kandungan agar aman untuk usia kehamilan Anda. Sementara nyeri punggung ringan–sedang, istirahat dan kompres hangat di area punggung bisa dicoba.`;
    }
  }

  const backPain = /nyeri.*punggung|punggung.*nyeri|sakit punggung/.test(blob);
  const pregnancy = /hamil|kehamilan|\d+\s*minggu/.test(blob);
  const weeks = blob.match(/\d+\s*minggu/)?.[0];
  const severe = /nyeri berat|sakit berat|sangat sakit/.test(blob);
  const neverBefore = /belum pernah|tidak pernah.*sebelum/.test(blob);

  if (backPain && pregnancy) {
    let text = `${honorific}, `;
    if (neverBefore && latestLower.includes("belum")) {
      text += `berarti nyeri punggung ini memang baru muncul sejak kehamilan`;
      if (weeks) text += ` (${weeks})`;
      text += `. `;
    } else {
      text += `mengingat keluhan nyeri punggung`;
      if (weeks) text += ` di ${weeks}`;
      if (severe) text += " yang terasa berat";
      text += `, `;
    }
    text +=
      "sering berkaitan dengan perubahan postur dan ligament di awal kehamilan — coba hindari berdiri/memberdiri lama, tidur miring dengan bantal di lutut, dan jangan mengangkat beban berat. ";
    if (severe) {
      text +=
        "Karena intensitasnya berat, segera ke faskes jika nyeri makin parah, disertai demam, keluar darah, atau nyeri yang menjalar ke kaki.";
    } else {
      text += "Ke faskes jika nyeri memburuk atau muncul tanda bahaya lain.";
    }
    return text;
  }

  const symptoms: string[] = [];
  if (facts.hasPusing || /pusing|vertigo/.test(blob)) symptoms.push("pusing");
  if (facts.hasMual || /mual|muntah/.test(blob)) symptoms.push("mual/muntah");
  if (facts.hasDemam || /demam/.test(blob)) symptoms.push("demam");
  if (facts.hasNyeri || /nyeri|sakit/.test(blob)) symptoms.push("nyeri");

  if (symptoms.length) {
    let text = `${honorific}, dari keluhan ${symptoms.join(" dan ")}`;
    if (pregnancy && weeks) text += ` pada kehamilan ${weeks}`;
    text += ", ";
    if (symptoms.includes("pusing") && /setelah makan/.test(blob)) {
      text +=
        "kemungkinan terkait reflek maag atau tekanan — coba makan porsi kecil dan hindari langsung berbaring setelah makan. ";
    } else if (symptoms.includes("mual/muntah") && pregnancy) {
      text +=
        "wajar di awal kehamilan — makan kecil teratur dan minum sedikit demi sedikit. Ke faskes jika muntah terus-menerus atau tidak bisa minum. ";
    } else {
      text += `perlu dipantau — istirahat secukupnya dan catat kapan keluhan memburuk. Ke faskes jika ${symptoms[0]} memburuk atau ada tanda bahaya. `;
    }
    return text.trim();
  }

  return buildNextInterviewReply({
    history: input.history,
    latestMessage: input.latestMessage,
    initialComplaint: input.initialComplaint,
    genericFallback: `${honorific}, terima kasih sudah menjelaskan. Bisa diceritakan sejak kapan keluhan ini mulai dirasakan dan seberapa mengganggu aktivitas sehari-hari?`,
  });
}
