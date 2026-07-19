/**
 * Gaya percakapan tenaga medis — dokter & bidan.
 * Mencegah respons template/generik; mendorong spesifik ke konteks pasien.
 */

import { analyzeInterviewFacts } from "@/src/lib/interview-context";

export type ClinicianRole = "doctor" | "midwife";

/** Frasa template/vague yang DILARANG — terdengar seperti bot, bukan tenaga medis. */
export const VAGUE_CLINICAL_PHRASES = [
  /kemungkinan perlu diperhatikan dan dievaluasi lebih lanjut/i,
  /perlu diperhatikan dan dievaluasi lebih lanjut/i,
  /keluhan perlu diperhatikan/i,
  /istirahat cukup.*minum air putih/i,
  /pantau keluhan.*segera ke faskes jika gejala memburuk/i,
  /usahakan istirahat cukup, minum air putih, dan pantau keluhan/i,
  /tim bidan kami akan membantu menilai/i,
  /terima kasih sudah menghubungi saya/i,
  /bisa dijelaskan lebih detail keluhannya/i,
  /selalu siap membantu/i,
  /apakah ada pertanyaan lain/i,
  /anda juga bisa melanjutkan chat jika ada detail tambahan/i,
];

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isVagueClinicalReply(text: string): boolean {
  const n = norm(text);
  if (!n || n.length < 20) return true;

  const hasSpecificRef =
    /punggung|perut|kepala|hamil|\d+\s*minggu|demam|mual|pusing|nyeri|batuk|makan|obat|tidur|berat|ringan|belum pernah|sejak|kali/.test(
      n
    );

  if (VAGUE_CLINICAL_PHRASES.some((p) => p.test(text))) {
    return !hasSpecificRef || n.length < 95;
  }

  if (n.length < 90 && !hasSpecificRef && /istirahat|minum air|pantau|faskes|evaluasi/.test(n)) {
    return true;
  }
  return false;
}

/** Ekstrak detail pasien yang WAJIB dirujuk agar balasan tidak generik. */
export function extractPatientContextAnchors(input: {
  history?: Array<{ role: string; text: string }>;
  latestMessage?: string;
  initialComplaint?: string | null;
}): string[] {
  const facts = analyzeInterviewFacts(input);
  const blob = [
    input.initialComplaint ?? "",
    ...facts.patientMessages,
    input.latestMessage ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const anchors: string[] = [];

  const weeks =
    blob.match(/\d+\s*minggu/)?.[0] ??
    (blob.includes("hamil") || blob.includes("kehamilan") ? "hamil (usia belum disebut)" : null);
  if (weeks && /hamil|kehamilan|minggu/.test(blob)) {
    anchors.push(`Kehamilan: ${weeks.includes("minggu") ? weeks : "sedang hamil"}`);
  }

  if (/nyeri.*punggung|punggung.*nyeri|sakit punggung|nyeri di bagian punggung/.test(blob)) {
    anchors.push("Keluhan utama: nyeri punggung");
  } else if (facts.hasNyeri) {
    anchors.push("Keluhan: nyeri/sakit");
  }
  if (/nyeri berat|sakit berat|sangat sakit|nyeri\s+berat/.test(blob)) {
    anchors.push("Intensitas: berat / sangat mengganggu");
  } else if (facts.severityKnown) {
    anchors.push("Intensitas keluhan sudah disebut pasien");
  }
  if (facts.hasPusing) anchors.push("Gejala: pusing");
  if (facts.hasMual) anchors.push("Gejala: mual/muntah");
  if (facts.hasDemam) anchors.push("Gejala: demam");
  if (facts.hasBatuk) anchors.push("Gejala: batuk/pilek");
  if (facts.onsetSummary) anchors.push(`Mulai: ${facts.onsetSummary}`);
  if (/belum pernah|tidak pernah.*sebelum/.test(blob)) {
    anchors.push("Riwayat: belum pernah mengalami keluhan serupa sebelumnya");
  }
  if (/overthinking|cemas|stres/.test(blob)) anchors.push("Faktor: stres/cemas");
  if (/kurang tidur|tidur kurang|insomnia/.test(blob)) anchors.push("Faktor: kurang tidur");
  if (/setelah makan|habis makan/.test(blob)) anchors.push("Konteks: keluhan terkait waktu makan");

  if (facts.patientMessages.length) {
    const latest = facts.patientMessages[facts.patientMessages.length - 1];
    if (latest && latest.length <= 120) {
      anchors.push(`Pesan terbaru pasien: "${latest.replace(/\bdok\b/gi, "").trim()}"`);
    }
  }

  return anchors;
}

export function formatPatientContextAnchorBlock(input: {
  history?: Array<{ role: string; text: string }>;
  latestMessage?: string;
  initialComplaint?: string | null;
}): string {
  const anchors = extractPatientContextAnchors(input);
  if (!anchors.length) {
    return "=== DETAIL PASIEN ===\n- Rujuk minimal 1 detail spesifik dari keluhan pasien di riwayat.";
  }
  return [
    "=== DETAIL PASIEN (WAJIB sebut minimal 1 dalam balasan — jangan jawab generik) ===",
    ...anchors.map((a) => `- ${a}`),
  ].join("\n");
}

export function clinicalConversationStyleRules(
  role: ClinicianRole,
  isFollowUp: boolean
): string {
  const persona =
    role === "doctor"
      ? "dokter spesialis berchat via aplikasi RS"
      : "bidan/perawat berpengalaman berchat via aplikasi RS";

  const lines = [
    `GAYA TENAGA MEDIS — Anda ${persona}, bukan chatbot atau call center:`,
    "- WAJIB merujuk detail SPESIFIK dari keluhan pasien (lokasi, lama, intensitas, usia kehamilan, dll).",
    "- Acknowledge jawaban pasien dengan merangkum fakta yang baru disampaikan ('berarti belum pernah sebelum kehamilan', dll).",
    "- Hindari frasa template: 'perlu diperhatikan dan dievaluasi lebih lanjut', 'pantau keluhan', 'minum air putih' saja tanpa konteks.",
    "- Anjuran harus relevan ke kasus: nyeri punggung hamil → postur, bantal lutut, hindari angkat berat; mual → makan kecil teratur.",
    "- Impresi awal: 'kemungkinan terkait ...' + alasan singkat — BUKAN diagnosis pasti.",
    "- DILARANG bullet/daftar angka. Maks 2–4 kalimat natural.",
    "- DILARANG 'Selalu siap membantu', 'Apakah ada pertanyaan lain?', 'Tim kami akan membantu menilai'.",
    "- Variasikan pembuka — jangan 'Baik Ibu, terima kasih informasinya' di setiap pesan.",
  ];

  if (isFollowUp) {
    lines.push(
      "- PESAN LANJUTAN: jawab langsung pertanyaan/inti pesan terbaru — jangan ulang seluruh riwayat.",
      "- Jika pasien bertanya (makanan, obat, aktivitas): jawab spesifik dulu, baru anjuran singkat."
    );
  } else {
    lines.push(
      "- Pembuka live: sapa hangat + tunjukkan Anda sudah baca keluhan + 1 pertanyaan SOAL paling penting."
    );
  }

  return lines.join("\n");
}

/** Contoh baik vs buruk — few-shot ringkas untuk prompt. */
export function clinicalReplyExamples(role: ClinicianRole): string {
  if (role === "midwife") {
    return [
      "CONTOH BURUK (JANGAN): 'Baik Ibu, terima kasih informasinya. Keluhan perlu diperhatikan. Istirahat cukup dan minum air putih.'",
      "CONTOH BAIK: 'Baik Ibu, mengingat nyeri punggung berat di usia kehamilan 4 minggu dan belum pernah dialami sebelumnya, sering terkait perubahan postur — seberapa sering nyerinya muncul, terus-menerus atau datang hilang?'",
      "CONTOH BAIK (tanya makanan): 'Iya Bu, asupan bergizi penting di trimester awal — makan kecil teratur dan cukup folat membantu. Untuk nyeri punggung, hindari posisi duduk lama; tidur miring dengan bantal di lutut bisa meringankan.'",
    ].join("\n");
  }
  return [
    "CONTOH BURUK (JANGAN): 'Terima kasih atas informasinya. Keluhan perlu dievaluasi lebih lanjut. Istirahat dan ke faskes jika memburuk.'",
    "CONTOH BAIK: 'Baik Bapak, berarti pusing sudah 2 hari dan muncul setelah makan siang — apakah pusingnya berputar atau seperti melayang?'",
    "CONTOH BAIK (impresi): 'Dari keluhan pusing setelah makan dan mual ringan, kemungkinan terkait reflek maag atau tekanan darah — coba makan porsi kecil dan hindari langsung berbaring setelah makan.'",
  ].join("\n");
}
