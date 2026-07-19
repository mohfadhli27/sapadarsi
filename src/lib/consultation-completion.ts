import { dbQuery } from "@/src/lib/db";
import { getVisibleMessages } from "@/src/lib/doctor-consultation-service";
import { getMidwifeVisibleMessages } from "@/src/lib/consultation-service";
import { chatCompletionsWithFallback } from "@/src/lib/nemotron-orchestrator";
import { getSessionPrescription } from "@/src/lib/prescription";
import type { ConsultationPrescription } from "@/src/types/prescription";

export type ConsultationSummaryCardData = {
  doctorName?: string | null;
  unitName?: string | null;
  scheduleDate?: string | null;
  complaint?: string | null;
  completedAt: string;
  advice: string;
  summaryText: string;
  keyFindings: string[];
  diagnosis?: string;
  followUp?: string;
};

type HistoryLine = { speaker: string; text: string };

const SKIP_NOTE_PATTERNS = [
  /sesi konsultasi telah selesai/i,
  /terima kasih telah menggunakan darsi/i,
  /resep digital/i,
  /memperbarui resep/i,
  /menerbitkan resep/i,
];

export function formatScheduleDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value);
  }
  return String(value);
}

function speakerLabel(senderType: string, senderName?: string, providerLabel = "Tenaga Kesehatan") {
  if (senderType === "patient") return "Pasien";
  if (senderType === "staff") return senderName ?? providerLabel;
  if (senderType === "agent") return senderName ?? "Koordinator DARSI";
  return senderName ?? "Sistem";
}

function normalizeDoctorMessages(
  messages: Awaited<ReturnType<typeof getVisibleMessages>>,
  providerLabel: string
): HistoryLine[] {
  return messages
    .filter((m) => m.senderType !== "system")
    .map((m) => ({
      speaker: speakerLabel(m.senderType, m.senderName, providerLabel),
      text: String(m.text ?? "").trim(),
    }))
    .filter((m) => m.text.length > 0 && !SKIP_NOTE_PATTERNS.some((p) => p.test(m.text)));
}

function normalizeMidwifeMessages(
  messages: Awaited<ReturnType<typeof getMidwifeVisibleMessages>>,
  providerLabel: string
): HistoryLine[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      let senderType = "assistant";
      if (m.role === "user") senderType = "patient";
      else if (m.role === "doctor") senderType = "staff";
      else if (m.role === "coordinator") senderType = "agent";
      return {
        speaker: speakerLabel(senderType, m.senderName, providerLabel),
        text: String(m.text ?? "").trim(),
      };
    })
    .filter((m) => m.text.length > 0 && !SKIP_NOTE_PATTERNS.some((p) => p.test(m.text)));
}

function buildFallbackSummary(input: {
  complaint: string | null;
  triageSummary: string | null;
  history: HistoryLine[];
  prescription: ConsultationPrescription | null;
  providerLabel: string;
  isDoctor: boolean;
}): ConsultationSummaryCardData["summaryText"] extends string ? Omit<ConsultationSummaryCardData, "doctorName" | "unitName" | "scheduleDate" | "complaint" | "completedAt"> & Pick<ConsultationSummaryCardData, "advice" | "summaryText" | "keyFindings" | "diagnosis" | "followUp"> : never {
  const staffNotes = input.history.filter((h) => h.speaker !== "Pasien" && h.speaker !== "Koordinator DARSI");
  const lastStaff = staffNotes.at(-1)?.text;
  const keyFindings = [
    input.complaint ? `Keluhan: ${input.complaint}` : null,
    input.triageSummary ? `Triage: ${input.triageSummary}` : null,
    input.prescription?.diagnosis ? `Diagnosis: ${input.prescription.diagnosis}` : null,
    lastStaff ? `Catatan ${input.providerLabel}: ${lastStaff.slice(0, 200)}` : null,
  ].filter((v): v is string => Boolean(v));

  const summaryText = [
    input.complaint ? `Pasien konsultasi dengan keluhan ${input.complaint}.` : "Pasien menyelesaikan sesi konsultasi.",
    input.triageSummary ? `Hasil triage awal: ${input.triageSummary}` : null,
    lastStaff ? `Anjuran dari ${input.providerLabel}: ${lastStaff}` : null,
    input.prescription
      ? `Resep diterbitkan dengan diagnosis ${input.prescription.diagnosis}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const advice =
    input.prescription?.generalAdvice ??
    (input.isDoctor
      ? "Istirahat cukup, minum air putih, dan ikuti anjuran dokter. Segera ke IGD jika gejala memburuk."
      : "Istirahat cukup, jaga asupan nutrisi, dan ikuti anjuran bidan/perawat. Segera ke IGD jika gejala memburuk.");

  return {
    summaryText,
    keyFindings,
    advice,
    diagnosis: input.prescription?.diagnosis,
    followUp: input.prescription?.followUp,
  };
}

function safeTrim(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

async function summarizeWithLlm(input: {
  serviceLabel: string;
  providerLabel: string;
  doctorName: string | null;
  unitName: string | null;
  complaint: string | null;
  triageSummary: string | null;
  history: HistoryLine[];
  prescription: ConsultationPrescription | null;
  fallback: ReturnType<typeof buildFallbackSummary>;
}) {
  const transcript = input.history
    .map((h) => `${h.speaker}: ${h.text}`)
    .join("\n")
    .slice(0, 12000);

  const rxBlock = input.prescription
    ? `\nResep:\nDiagnosis: ${input.prescription.diagnosis}\nObat: ${input.prescription.medications.map((m) => m.name).join(", ")}\nAnjuran resep: ${input.prescription.generalAdvice ?? "-"}\nKontrol: ${input.prescription.followUp ?? "-"}`
    : "";

  const system = [
    "Anda asisten medis RSI A. Yani yang menyusun ringkasan hasil telekonsultasi DARSI.",
    "Gunakan Bahasa Indonesia formal, ringkas, dan mudah dipahami pasien.",
    "Jangan menambahkan diagnosis baru yang tidak ada dalam percakapan atau resep.",
    "Output HANYA JSON valid dengan format:",
    '{"summaryText":"...","keyFindings":["..."],"advice":"...","diagnosis":"...","followUp":"..."}',
    "summaryText: 2-4 kalimat narasi hasil konsultasi.",
    "keyFindings: 2-5 poin bullet singkat.",
    "advice: anjuran praktis untuk pasien.",
    "diagnosis: isi jika jelas dari percakapan/resep, else kosong.",
    "followUp: rencana kontrol jika ada, else kosong.",
  ].join("\n");

  const user = [
    `Layanan: ${input.serviceLabel}`,
    `Tenaga kesehatan: ${input.doctorName ?? "-"} (${input.unitName ?? "-"})`,
    `Keluhan awal: ${input.complaint ?? "-"}`,
    input.triageSummary ? `Ringkasan triage: ${input.triageSummary}` : null,
    rxBlock,
    "Transcript konsultasi:",
    transcript || "(tidak ada pesan tambahan)",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { content } = await chatCompletionsWithFallback({
      system,
      user,
      jsonMode: true,
    });
    const parsed = JSON.parse(content) as {
      summaryText?: string;
      keyFindings?: string[];
      advice?: string;
      diagnosis?: string;
      followUp?: string;
    };
    return {
      summaryText: safeTrim(parsed.summaryText) || input.fallback.summaryText,
      keyFindings:
        Array.isArray(parsed.keyFindings) && parsed.keyFindings.length > 0
          ? parsed.keyFindings.map(String).filter(Boolean)
          : input.fallback.keyFindings,
      advice: safeTrim(parsed.advice) || input.fallback.advice,
      diagnosis: safeTrim(parsed.diagnosis) || input.fallback.diagnosis,
      followUp: safeTrim(parsed.followUp) || input.fallback.followUp,
    };
  } catch (error) {
    console.warn("[consultation-completion] LLM summary fallback", error);
    return input.fallback;
  }
}

export async function buildConsultationSummaryCard(
  sessionId: number,
  serviceType: "doctor_consultation" | "midwife_consultation"
): Promise<ConsultationSummaryCardData> {
  const isDoctor = serviceType === "doctor_consultation";
  const providerLabel = isDoctor ? "Dokter" : "Bidan/Perawat";
  const serviceLabel = isDoctor ? "Konsultasi Dokter" : "Konsultasi Bidan/Perawat";

  const sessionResult = await dbQuery<{
    initial_complaint: string | null;
    doctor_name: string | null;
    unit_name: string | null;
    schedule_date: unknown;
    triage_summary: string | null;
  }>(
    `select cs.initial_complaint, dcm.doctor_name, dcm.unit_name, dcm.schedule_date, dcm.triage_summary
     from chat_sessions cs
     join doctor_consultation_meta dcm on dcm.session_id = cs.id
     where cs.id = $1 limit 1`,
    [sessionId]
  );
  const row = sessionResult.rows[0];
  if (!row) throw new Error("Metadata konsultasi tidak ditemukan");

  const history = isDoctor
    ? normalizeDoctorMessages(await getVisibleMessages(sessionId), providerLabel)
    : normalizeMidwifeMessages(await getMidwifeVisibleMessages(sessionId), providerLabel);

  const prescription = await getSessionPrescription(sessionId);
  const fallback = buildFallbackSummary({
    complaint: row.initial_complaint,
    triageSummary: row.triage_summary,
    history,
    prescription,
    providerLabel,
    isDoctor,
  });

  const llm = await summarizeWithLlm({
    serviceLabel,
    providerLabel,
    doctorName: row.doctor_name,
    unitName: row.unit_name,
    complaint: row.initial_complaint,
    triageSummary: row.triage_summary,
    history,
    prescription,
    fallback,
  });

  return {
    doctorName: row.doctor_name,
    unitName: row.unit_name,
    scheduleDate: formatScheduleDate(row.schedule_date),
    complaint: row.initial_complaint,
    completedAt: new Date().toISOString(),
    ...llm,
  };
}
