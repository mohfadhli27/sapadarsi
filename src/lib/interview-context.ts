/**
 * Analisis konteks wawancara dari riwayat chat — agar agent lanjut, tidak mengulang.
 */

export type ThreadRole = "patient" | "doctor" | "midwife" | "coordinator";

export type ThreadTurn = { role: ThreadRole; text: string };

export type InterviewTopic = "pusing" | "mual" | "nyeri" | "demam" | "batuk" | "general";

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeLatestPatientTurn<T extends { role: string; text: string }>(
  history: T[],
  latestMessage?: string
): T[] {
  if (!latestMessage?.trim() || history.length === 0) return history;
  const last = history[history.length - 1];
  if (last.role === "patient" && norm(last.text) === norm(latestMessage)) {
    return history.slice(0, -1);
  }
  return history;
}

export type InterviewFacts = {
  complaintText: string;
  patientMessages: string[];
  clinicianMessages: string[];
  activeTopic: InterviewTopic;
  hasPusing: boolean;
  hasDemam: boolean;
  hasNyeri: boolean;
  hasBatuk: boolean;
  hasMual: boolean;
  onsetKnown: boolean;
  onsetSummary: string | null;
  frequencyKnown: boolean;
  severityKnown: boolean;
  associatedSymptomsMentioned: boolean;
  patientClosing: boolean;
  lastDoctorQuestion: string | null;
};

const ONSET_PATTERNS =
  /\b(kemarin|hari ini|tadi (pagi|siang|sore|malam)|\d+\s*(hari|minggu|bulan)|sejak|baru|semalam|minggu lalu)\b/i;

const SEVERITY_PATTERNS =
  /\b(ringan|sedang|berat|parah|tidak terlalu|lumayan|sekali|sakit sekali|tahan|nggak bisa)\b/i;

const ASSOCIATED_PATTERNS =
  /\b(mual|muntah|pandangan berkabut|berkabut|pusing berputar|mata berkunang|sesak|demam|nyeri)\b/i;

const FREQUENCY_PATTERNS =
  /\b(\d+\s*-\s*\d+|\d+)\s*kali|\bkali\s+(dalam\s+)?(sehari|hari)|per\s+hari|sekali\s+(sehari|dalam sehari)\b/i;

const CLOSING_PATTERNS =
  /\b(hanya itu|itu saja|udah itu saja|cukup itu|tidak ada lagi|ga ada lagi|gak ada lagi|nggak ada lagi|sudah cukup|sudah jelas|keluhannya cukup)\b/i;

/** Pasien mengajukan pertanyaan lanjutan — harus dijawab, bukan di-skip ke template penutup. */
export function isPatientFollowUpQuestion(text?: string | null): boolean {
  if (!text?.trim()) return false;
  if (isPatientClosingMessage(text)) return false;
  const raw = text.trim();
  if (raw.includes("?")) return true;
  const m = norm(raw.replace(/\bdok\b/g, "").replace(/\bbidan\b/g, "").replace(/\bbu\b/g, ""));
  return /^(apakah|apa|bagaimana|gimana|bisa|boleh|kenapa|mengapa|mungkin)\b/.test(m);
}

export function isPatientClosingMessage(text?: string | null): boolean {
  if (!text?.trim()) return false;
  const latest = text.trim();
  if (CLOSING_PATTERNS.test(latest)) return true;
  const m = latest.toLowerCase();
  return (
    /^(baik|ok|oke|siap)[,.\s]*(terima\s*kasih|makasih|thanks)/i.test(m) ||
    /^(terima\s*kasih|makasih|thanks)/i.test(m) ||
    /terima\s*kasih\s*(dok|dokter|bidan|perawat)?\s*$/i.test(m)
  );
}

function clinicianRole(role: ThreadRole): boolean {
  return role === "doctor" || role === "midwife";
}

function inferTopicFromText(text: string): InterviewTopic | null {
  const t = text.toLowerCase();
  if (/mual|muntah/.test(t)) return "mual";
  if (/pusing|vertigo/.test(t)) return "pusing";
  if (/demam|panas badan|suhu/.test(t)) return "demam";
  if (/batuk|pilek|flu/.test(t)) return "batuk";
  if (/nyeri|sakit/.test(t)) return "nyeri";
  return null;
}

function inferActiveTopic(
  lastQuestion: string | null,
  contextText: string
): InterviewTopic {
  const fromQuestion = lastQuestion ? inferTopicFromText(lastQuestion) : null;
  if (fromQuestion) return fromQuestion;
  const fromContext = inferTopicFromText(contextText);
  return fromContext ?? "general";
}

function summarizeOnset(patientMessages: string[]): string | null {
  for (let i = patientMessages.length - 1; i >= 0; i--) {
    if (ONSET_PATTERNS.test(patientMessages[i])) {
      return patientMessages[i].replace(/\bdok\b/gi, "").trim();
    }
  }
  return null;
}

export function analyzeInterviewFacts(input: {
  history?: Array<{ role: string; text: string }>;
  latestMessage?: string;
  initialComplaint?: string | null;
}): InterviewFacts {
  const history = (input.history ?? []) as ThreadTurn[];
  const patientMessages = history.filter((h) => h.role === "patient").map((h) => h.text.trim());
  if (input.latestMessage?.trim()) {
    const latest = input.latestMessage.trim();
    if (!patientMessages.some((m) => norm(m) === norm(latest))) {
      patientMessages.push(latest);
    }
  }

  const clinicianMessages = history
    .filter((h) => clinicianRole(h.role))
    .map((h) => h.text.trim());

  const contextText = [
    input.initialComplaint ?? "",
    ...patientMessages,
    ...clinicianMessages.slice(-2),
  ]
    .join(" ")
    .toLowerCase();

  const lastDoctorQuestion =
    [...clinicianMessages].reverse().find((m) => m.includes("?")) ?? null;

  const activeTopic = inferActiveTopic(lastDoctorQuestion, contextText);

  const onsetKnown = patientMessages.some((m) => ONSET_PATTERNS.test(m));
  const onsetSummary = summarizeOnset(patientMessages);
  const frequencyKnown = patientMessages.some((m) => FREQUENCY_PATTERNS.test(m));
  const latest = input.latestMessage?.trim() ?? "";

  return {
    complaintText: contextText,
    patientMessages,
    clinicianMessages,
    activeTopic,
    hasPusing: /pusing|vertigo|pusing berputar/.test(contextText),
    hasDemam: /demam|panas badan|suhu/.test(contextText),
    hasNyeri: /nyeri|sakit/.test(contextText),
    hasBatuk: /batuk|pilek|flu/.test(contextText),
    hasMual: /mual|muntah/.test(contextText),
    onsetKnown,
    onsetSummary,
    frequencyKnown,
    severityKnown: patientMessages.some((m) => SEVERITY_PATTERNS.test(m)),
    associatedSymptomsMentioned: patientMessages.some((m) => ASSOCIATED_PATTERNS.test(m)),
    patientClosing: CLOSING_PATTERNS.test(latest),
    lastDoctorQuestion,
  };
}

export function formatKnownFactsSummary(facts: InterviewFacts): string {
  const lines: string[] = [];
  if (facts.activeTopic !== "general") lines.push(`- Topik wawancara aktif: ${facts.activeTopic}`);
  if (facts.hasPusing) lines.push("- Keluhan: pusing");
  if (facts.hasDemam) lines.push("- Keluhan: demam");
  if (facts.hasNyeri) lines.push("- Keluhan: nyeri/sakit");
  if (facts.hasBatuk) lines.push("- Keluhan: batuk/pilek");
  if (facts.hasMual) lines.push("- Keluhan: mual/muntah");
  if (facts.onsetKnown && facts.onsetSummary) {
    lines.push(`- Sudah dijawab: mulai ${facts.onsetSummary}`);
  }
  if (facts.frequencyKnown) lines.push("- Frekuensi/berapa kali sudah dijawab pasien");
  if (facts.severityKnown) lines.push("- Intensitas/berat keluhan sudah disebut pasien");
  if (facts.associatedSymptomsMentioned) {
    lines.push("- Gejala pendamping sudah disebut pasien");
  }
  if (facts.patientMessages.length) {
    lines.push(`- Pesan pasien dalam sesi: ${facts.patientMessages.join(" | ")}`);
  }
  return lines.length ? lines.join("\n") : "- Belum ada fakta lengkap";
}

function buildClosingReply(facts: InterviewFacts): string {
  const topic = facts.activeTopic;
  if (topic === "mual" || facts.hasMual) {
    return "Baik, terima kasih informasinya. Untuk sementara istirahatkan tubuh dan perbanyak minum air putih. Jika mual berubah menjadi muntah terus-menerus, tidak bisa makan/minum, atau ada tanda dehidrasi, segera ke faskes terdekat.";
  }
  if (topic === "pusing" || facts.hasPusing) {
    return "Baik, terima kasih informasinya. Istirahat cukup dan hindari aktivitas berat. Jika pusing memburuk, disertai muntah terus-menerus, atau pandangan kabur, segera ke faskes terdekat.";
  }
  return "Baik, terima kasih informasinya. Jaga istirahat dan cukup minum. Jika keluhan memburuk atau muncul tanda bahaya, segera ke faskes terdekat.";
}

function stripPatientVocative(text: string): string {
  return text
    .replace(/\b(dok|dokter|bu bidan|bidan|perawat|bu|pak)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ringkas jawaban pasien dengan kata bidan/dokter — DILARANG kutip verbatim. */
function acknowledgePatientAnswer(latest: string, facts: InterviewFacts): string {
  const t = stripPatientVocative(latest).toLowerCase();

  if (/rebahan|berbaring|tidur terlalu|tidur seharian|jarang bergerak|banyak tidur|sering tidur/.test(t)) {
    const gest = t.match(/(\d+\s*(minggu|bulan))/)?.[0];
    if (gest) {
      return `Baik, berarti di usia kehamilan ${gest} Ibu cenderung banyak beristirahat/berbaring.`;
    }
    return "Baik, berarti Ibu cenderung banyak beristirahat/berbaring selama kehamilan ini.";
  }
  if (/^belum\s+pernah|tidak\s+pernah/.test(t)) {
    return "Baik, berarti belum pernah mengalami keluhan serupa sebelum kehamilan ini.";
  }
  if (/^(ya|iya)\b/.test(t) || (/\bpernah\b/.test(t) && !/belum pernah|tidak pernah/.test(t))) {
    return "Baik, berarti pernah mengalami hal serupa sebelumnya.";
  }
  if (/ringan|sedang|berat|parah|sakit sekali|mengganggu/.test(t)) {
    if (/sangat|parah|berat|sekali/.test(t)) {
      return "Baik, berarti nyerinya terasa cukup berat/mengganggu.";
    }
    if (/sedang/.test(t)) return "Baik, berarti intensitasnya sedang.";
    if (/ringan/.test(t)) return "Baik, berarti masih terasa ringan.";
    return "Baik, terima kasih atas penjelasan intensitas keluhannya.";
  }
  if (FREQUENCY_PATTERNS.test(latest)) {
    return "Baik, terima kasih — frekuensinya sudah saya catat.";
  }
  // Onset gejala — bukan usia kehamilan ("hamil 4 bulan")
  const symptomOnset = latest.match(
    /\b(sejak\s+\d+\s*(hari|minggu)|kemarin|hari ini|tadi|baru\s+\d+\s*(hari|minggu)|semalam)\b/i
  );
  if (symptomOnset) {
    return `Baik, berarti keluhannya mulai ${symptomOnset[0].replace(/^sejak\s+/i, "sejak ")}.`;
  }
  if (/terus menerus|terus|hilang timbul|datang pergi/.test(t)) {
    return "Baik, terima kasih — pola nyerinya sudah jelas.";
  }
  return "Baik, terima kasih sudah menjelaskan.";
}

function nextQuestionForTopic(facts: InterviewFacts): string {
  switch (facts.activeTopic) {
    case "mual":
      if (!facts.onsetKnown) {
        return "Sejak kapan mual atau muntahnya dirasakan?";
      }
      if (!facts.frequencyKnown) {
        return "Berapa kali mual atau muntahnya dalam sehari?";
      }
      return "Apakah yang keluar benar-benar muntahan, atau lebih kepada mual saja? Ada darah atau tidak?";
    case "pusing":
      if (!facts.onsetKnown) return "Sejak kapan pusingnya dirasakan?";
      if (!facts.associatedSymptomsMentioned) {
        return "Apakah pusingnya disertai mual, muntah, atau pandangan berkabut?";
      }
      if (!facts.severityKnown) {
        return "Seberapa berat pusingnya — ringan, sedang, atau cukup mengganggu aktivitas?";
      }
      return "Apakah ada faktor yang memperberat pusing, misalnya bergerak atau melihat cahaya?";
    case "demam":
      if (!facts.onsetKnown) return "Sejak kapan demamnya dirasakan?";
      return "Berapa suhu tubuh terakhir yang diukur, dan apakah ada batuk atau pilek?";
    case "nyeri":
      if (/hamil|kehamilan|punggung/.test(facts.complaintText)) {
        const latestNorm = stripPatientVocative(facts.patientMessages.at(-1) ?? "").toLowerCase();
        if (/rebahan|berbaring|istirahat|tidur/.test(latestNorm)) {
          return "Apakah posisi berbaring/istirahat meringankan nyeri punggung, atau justru makin terasa?";
        }
        if (!facts.severityKnown) {
          return "Seberapa berat nyeri punggungnya — apakah mengganggu tidur atau aktivitas sehari-hari?";
        }
        if (!facts.frequencyKnown) {
          return "Apakah nyerinya terus-menerus sepanjang hari, atau datang hilang muncul?";
        }
        return "Apakah ada gejala lain seperti demam, keluar darah, atau nyeri yang menjalar ke kaki?";
      }
      if (!facts.onsetKnown) return "Sejak kapan nyerinya dirasakan, dan di bagian mana tepatnya?";
      if (!facts.severityKnown) return "Seberapa berat nyerinya — ringan, sedang, atau sangat mengganggu?";
      return "Apakah nyerinya menjalar ke bagian lain atau disertai kelemahan?";
    case "batuk":
      if (!facts.onsetKnown) return "Sejak kapan batuk atau pileknya mulai?";
      return "Apakah batuknya disertai demam atau sesak napas?";
    default:
      return "Apakah ada gejala lain yang dirasakan selain yang sudah Anda ceritakan?";
  }
}

export function buildNextInterviewReply(input: {
  history?: Array<{ role: string; text: string }>;
  latestMessage?: string;
  initialComplaint?: string | null;
  genericFallback?: string;
}): string {
  const facts = analyzeInterviewFacts(input);
  const latest = input.latestMessage?.trim() ?? "";

  if (facts.patientClosing) {
    return buildClosingReply(facts);
  }

  if (latest) {
    const ack = acknowledgePatientAnswer(latest, facts);
    const next = nextQuestionForTopic(facts);
    const latestNorm = stripPatientVocative(latest).toLowerCase();
    const hasSubstantiveAnswer =
      facts.frequencyKnown ||
      facts.severityKnown ||
      FREQUENCY_PATTERNS.test(latest) ||
      /rebahan|berbaring|belum pernah|tidak pernah|ringan|sedang|berat|parah/.test(latestNorm) ||
      /\b(sejak|kemarin|hari ini|baru)\b/i.test(latest);
    if (hasSubstantiveAnswer) {
      return `${ack} ${next}`;
    }
  }

  if (facts.activeTopic !== "general") {
    return `${acknowledgePatientAnswer(latest, facts)} ${nextQuestionForTopic(facts)}`.trim();
  }

  if (facts.hasPusing) {
    return `${acknowledgePatientAnswer(latest, facts)} ${nextQuestionForTopic({ ...facts, activeTopic: "pusing" })}`.trim();
  }
  if (facts.hasMual) {
    return `${acknowledgePatientAnswer(latest, facts)} ${nextQuestionForTopic({ ...facts, activeTopic: "mual" })}`.trim();
  }
  if (facts.hasDemam) {
    return `${acknowledgePatientAnswer(latest, facts)} ${nextQuestionForTopic({ ...facts, activeTopic: "demam" })}`.trim();
  }
  if (facts.hasNyeri) {
    return `${acknowledgePatientAnswer(latest, facts)} ${nextQuestionForTopic({ ...facts, activeTopic: "nyeri" })}`.trim();
  }
  if (facts.hasBatuk) {
    return `${acknowledgePatientAnswer(latest, facts)} ${nextQuestionForTopic({ ...facts, activeTopic: "batuk" })}`.trim();
  }

  return (
    input.genericFallback ??
    "Terima kasih sudah menjelaskan. Bisa diceritakan sejak kapan keluhan ini mulai dirasakan?"
  );
}

export function isRepeatOfPriorClinicianReply(
  reply: string,
  history?: ThreadTurn[]
): boolean {
  const normalized = norm(reply);
  if (!normalized) return false;

  for (const turn of history ?? []) {
    if (!clinicianRole(turn.role)) continue;
    const prior = norm(turn.text);
    if (!prior) continue;
    if (normalized === prior) return true;
    if (normalized.length > 40 && prior.length > 40) {
      const shorter = normalized.length <= prior.length ? normalized : prior;
      const longer = shorter === normalized ? prior : normalized;
      if (longer.includes(shorter) && shorter.length / longer.length >= 0.85) {
        return true;
      }
    }
  }
  return false;
}
