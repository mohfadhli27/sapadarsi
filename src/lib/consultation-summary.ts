import { createHash, randomBytes } from "crypto";
import { dbQuery } from "@/src/lib/db";
import { getDoctorSession, getVisibleMessages } from "@/src/lib/doctor-consultation-service";
import { getMidwifeSession, getMidwifeVisibleMessages } from "@/src/lib/consultation-service";
import { HOSPITAL, getSessionPrescription } from "@/src/lib/prescription";
import {
  DOCUMENT_SCREEN_MOBILE_CSS,
  documentStandaloneSaveToolbarHtml,
  documentToolbarCss,
  type DocumentHtmlOptions,
} from "@/src/lib/document-html-layout";
import type { ConsultationPrescription } from "@/src/types/prescription";
import type {
  ConsultationOutcomeNote,
  ConsultationSummaryDocument,
} from "@/src/types/consultation-summary";

type PatientRow = {
  nama: string | null;
  no_rm: string;
  tgl_lahir: string | null;
  sex: string | null;
  alamat: string | null;
};

const SKIP_NOTE_PATTERNS = [
  /sesi konsultasi telah selesai/i,
  /terima kasih telah menggunakan darsi/i,
  /resep digital/i,
  /memperbarui resep/i,
  /menerbitkan resep/i,
  /unduh resep melalui kartu resep/i,
];

function formatSex(sex: string | null | undefined) {
  if (!sex) return "-";
  if (sex.toUpperCase() === "L") return "Laki-laki";
  if (sex.toUpperCase() === "P") return "Perempuan";
  return sex;
}

function calcAge(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return `${years} tahun`;
}

function toText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value);
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatScheduleDateDisplay(value: unknown): string | null {
  if (value == null) return null;
  const d = toDate(value);
  if (d) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }
  const text = toText(value).trim();
  return text || null;
}

function formatDateId(value: unknown) {
  const d = toDate(value);
  if (!d) return toText(value) || "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatDateShort(value: unknown) {
  const d = toDate(value);
  if (!d) return toText(value) || "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function formatDateTime(value: unknown) {
  const d = toDate(value);
  if (!d) return toText(value) || "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function escapeHtml(value: unknown) {
  return toText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function summaryDocumentNo(sessionId: number) {
  const year = new Date().getFullYear();
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `SM-${year}-${String(sessionId).padStart(5, "0")}-${suffix}`;
}

function summaryVerificationCode(documentNo: string, sessionId: number) {
  return createHash("sha256")
    .update(`${documentNo}:${sessionId}:darsi-summary`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

function shouldSkipNote(text: string) {
  return SKIP_NOTE_PATTERNS.some((pattern) => pattern.test(text));
}

function extractConsultationNotes(
  messages: Array<{
    senderType: string;
    text: string;
    senderName?: string;
    createdAt: string | Date;
  }>,
  providerLabel: string
): ConsultationOutcomeNote[] {
  return messages
    .filter((m) => m.senderType === "staff" || m.senderType === "agent")
    .map((m) => ({ ...m, text: toText(m.text).trim() }))
    .filter((m) => m.text.length > 0)
    .filter((m) => !shouldSkipNote(m.text))
    .map((m) => ({
      speaker:
        m.senderType === "staff"
          ? m.senderName ?? providerLabel
          : "Koordinator DARSI",
      text: m.text,
      at:
        m.createdAt instanceof Date
          ? m.createdAt.toISOString()
          : toText(m.createdAt) || new Date().toISOString(),
    }));
}

async function loadPatient(patientId: number) {
  const patientResult = await dbQuery<PatientRow>(
    `select nama, no_rm, tgl_lahir, sex, alamat
     from pasienkonsul.b_ms_pasien where id = $1 limit 1`,
    [patientId]
  );
  const patient = patientResult.rows[0];
  if (!patient) return null;

  return {
    name: patient.nama ?? "Pasien",
    medicalRecordNumber: toText(patient.no_rm) || "-",
    birthDate: patient.tgl_lahir,
    sex: formatSex(patient.sex),
    address: patient.alamat,
    age: calcAge(patient.tgl_lahir),
  };
}

function parseSummaryCardFields(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return { summaryText: null as string | null, keyFindings: [] as string[] };
  }
  const card = raw as { summaryText?: unknown; keyFindings?: unknown };
  return {
    summaryText: typeof card.summaryText === "string" ? card.summaryText : null,
    keyFindings: Array.isArray(card.keyFindings)
      ? card.keyFindings.map(String).filter(Boolean)
      : [],
  };
}

function parseSummaryAdvice(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const advice = (raw as { advice?: unknown }).advice;
  return typeof advice === "string" && advice.trim() ? advice.trim() : null;
}

function parseCompletedAt(raw: unknown, fallback: string | null) {
  if (raw && typeof raw === "object") {
    const completedAt = (raw as { completedAt?: unknown }).completedAt;
    if (typeof completedAt === "string" && completedAt) return completedAt;
  }
  return fallback ?? new Date().toISOString();
}

type SessionMeta = {
  doctor_name?: string | null;
  unit_name?: string | null;
  schedule_date?: string | null;
  triage_summary?: string | null;
  summary_card?: unknown;
};

async function loadSessionMeta(sessionId: number): Promise<SessionMeta> {
  const result = await dbQuery<SessionMeta>(
    `select doctor_name, unit_name, schedule_date, triage_summary, summary_card
     from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  return result.rows[0] ?? {};
}

export async function buildConsultationSummaryDocument(
  sessionId: number,
  patientId: number,
  serviceType: "doctor_consultation" | "midwife_consultation"
): Promise<ConsultationSummaryDocument | null> {
  const isDoctor = serviceType === "doctor_consultation";
  let status: string;
  let initialComplaint: string | null;
  let meta: SessionMeta;

  if (isDoctor) {
    const session = await getDoctorSession(sessionId, patientId);
    status = session.row.status;
    initialComplaint = session.row.initial_complaint;
    meta = session.meta as SessionMeta;
  } else {
    const session = await getMidwifeSession(sessionId, patientId);
    status = session.status;
    initialComplaint = session.initial_complaint;
    meta = await loadSessionMeta(sessionId);
  }

  if (status !== "completed") {
    throw new Error("Ringkasan hanya tersedia setelah konsultasi selesai");
  }

  const completedAtResult = await dbQuery<{ completed_at: Date | null }>(
    `select completed_at from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const completedAtDb = completedAtResult.rows[0]?.completed_at?.toISOString() ?? null;

  const patient = await loadPatient(patientId);
  if (!patient) return null;

  const doctorMessages = isDoctor ? await getVisibleMessages(sessionId) : [];
  const midwifeMessages = isDoctor ? [] : await getMidwifeVisibleMessages(sessionId);

  const providerLabel = isDoctor ? "Dokter" : "Bidan/Perawat";
  const serviceLabel = isDoctor ? "Konsultasi Dokter" : "Konsultasi Bidan/Perawat";

  const prescription = (await getSessionPrescription(sessionId)) as ConsultationPrescription | null;

  const documentNo = summaryDocumentNo(sessionId);
  const verificationCode = summaryVerificationCode(documentNo, sessionId);
  const cardFields = parseSummaryCardFields(meta.summary_card);
  const advice =
    prescription?.generalAdvice ??
    parseSummaryAdvice(meta.summary_card) ??
    (isDoctor
      ? "Istirahat cukup, minum air putih, dan ikuti anjuran dokter. Segera ke IGD jika gejala memburuk."
      : "Istirahat cukup, jaga asupan nutrisi, dan ikuti anjuran bidan/perawat. Segera ke IGD jika gejala memburuk.");

  return {
    documentNo,
    sessionId,
    serviceType,
    serviceLabel,
    providerLabel,
    completedAt: parseCompletedAt(meta.summary_card, completedAtDb),
    scheduleDate: formatScheduleDateDisplay(meta.schedule_date),
    complaint: initialComplaint,
    triageSummary: meta.triage_summary ?? null,
    consultationNotes: extractConsultationNotes(
      isDoctor
        ? doctorMessages.map((m) => ({
            senderType: m.senderType,
            text: m.text,
            senderName: m.senderName,
            createdAt: m.createdAt,
          }))
        : midwifeMessages.map((m) => ({
            senderType:
              m.role === "user"
                ? "patient"
                : m.senderName
                  ? "staff"
                  : "agent",
            text: m.text,
            senderName: m.senderName,
            createdAt: m.createdAt,
          })),
      providerLabel
    ),
    advice,
    patient,
    provider: {
      name: meta.doctor_name ?? "-",
      unitName: meta.unit_name,
      sip: prescription?.doctorSip ?? null,
    },
    prescription,
    verificationCode,
    hospitalName: HOSPITAL.name,
    hospitalAddress: HOSPITAL.address,
    hospitalPhone: HOSPITAL.phone,
    hospitalWebsite: HOSPITAL.website,
    summaryText: cardFields.summaryText,
    keyFindings: cardFields.keyFindings,
  };
}

function noteBlock(note: ConsultationOutcomeNote) {
  return `
    <div class="note-item">
      <div class="note-meta">${escapeHtml(note.speaker)} · ${escapeHtml(formatDateTime(note.at))}</div>
      <div class="note-text">${escapeHtml(note.text)}</div>
    </div>
  `;
}

function medicationLine(med: ConsultationPrescription["medications"][number], index: number) {
  const strength = med.strength ? ` ${escapeHtml(med.strength)}` : "";
  return `
    <li>
      <strong>${index + 1}. ${escapeHtml(med.name)}${strength}</strong>
      <div class="rx-line">${escapeHtml(med.dosage)}, ${escapeHtml(med.frequency)}, ${escapeHtml(med.route)} · ${escapeHtml(med.duration)}</div>
    </li>
  `;
}

export function renderConsultationSummaryHtml(
  doc: ConsultationSummaryDocument,
  options?: DocumentHtmlOptions
) {
  const notes = doc.consultationNotes.map(noteBlock).join("");
  const rx = doc.prescription;
  const embed = options?.embed === true;
  const logoSrc = options?.inlineLogoDataUri ?? "/logos/yarsis-logo.png";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ringkasan Konsultasi ${escapeHtml(doc.documentNo)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color: #111827;
      background: #f3f4f6;
      line-height: 1.45;
    }
    .toolbar {
      position: sticky; top: 0; z-index: 10;
      display: flex; gap: 8px; justify-content: center;
      padding: 12px; background: #065f46; color: white;
    }
    .toolbar button {
      border: none; border-radius: 8px; padding: 10px 18px;
      font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .btn-print { background: white; color: #065f46; }
    .btn-close { background: #047857; color: white; }
    .page {
      width: 210mm; min-height: 297mm; margin: 16px auto;
      background: white; padding: 14mm 16mm;
      box-shadow: 0 8px 30px rgba(0,0,0,.12);
    }
    .header {
      display: flex; justify-content: space-between; gap: 16px;
      border-bottom: 3px solid #047857; padding-bottom: 12px;
    }
    .hospital-brand {
      display: flex; align-items: flex-start; gap: 10px;
    }
    .hospital-logo {
      width: 52px; height: 52px; object-fit: contain; flex-shrink: 0;
    }
    .hospital h1 { font-size: 17px; color: #047857; }
    .hospital p { font-size: 11px; color: #4b5563; margin-top: 2px; }
    .doc-meta { text-align: right; font-size: 11px; }
    .doc-meta .title {
      font-size: 14px; font-weight: 700; color: #047857;
      letter-spacing: .04em; margin-bottom: 4px;
    }
    .section { margin-top: 14px; }
    .section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: #047857; margin-bottom: 6px;
    }
    .grid-2 {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px;
      font-size: 12px;
    }
    .field label { display: block; font-size: 10px; color: #6b7280; }
    .field span { font-weight: 600; }
    .content-box {
      border: 1px solid #d1d5db; border-radius: 8px;
      padding: 10px 12px; font-size: 12px; background: #f9fafb;
    }
    .note-item {
      padding: 8px 0; border-bottom: 1px dashed #e5e7eb;
    }
    .note-item:last-child { border-bottom: none; }
    .note-meta { font-size: 10px; color: #6b7280; margin-bottom: 3px; }
    .note-text { font-size: 12px; color: #374151; white-space: pre-wrap; }
    .rx-line { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .advice {
      font-size: 12px; border-left: 3px solid #047857;
      padding: 8px 12px; background: #ecfdf5;
    }
    .footer {
      margin-top: 20px; display: flex; justify-content: space-between; gap: 20px;
      align-items: flex-end;
    }
    .verify {
      font-size: 10px; color: #4b5563; max-width: 55%;
    }
    .verify code {
      display: inline-block; margin-top: 4px;
      padding: 4px 8px; background: #f3f4f6;
      border: 1px solid #d1d5db; border-radius: 4px;
      font-family: monospace; font-size: 11px; letter-spacing: .08em;
    }
    .signature {
      text-align: center; min-width: 200px; font-size: 12px;
    }
    .sign-line {
      margin: 48px auto 8px; width: 180px;
      border-bottom: 1px solid #111827;
    }
    .disclaimer {
      margin-top: 16px; padding-top: 10px; border-top: 1px solid #e5e7eb;
      font-size: 9px; color: #6b7280; text-align: justify;
    }
    .stamp {
      display: inline-block; margin-top: 6px;
      padding: 4px 10px; border: 2px solid #047857; color: #047857;
      font-size: 10px; font-weight: 700; border-radius: 4px;
      transform: rotate(-4deg);
    }
    ul { padding-left: 18px; }
    li { margin-bottom: 6px; }
    @media print {
      body { background: white; }
      .toolbar { display: none !important; }
      .page { margin: 0; box-shadow: none; width: auto; min-height: auto; }
    }
    ${options?.pdf ? "" : DOCUMENT_SCREEN_MOBILE_CSS}
    ${documentToolbarCss(options)}
  </style>
</head>
<body>
  ${embed ? "" : documentStandaloneSaveToolbarHtml()}

  <div class="page">
    <div class="header">
      <div class="hospital">
        <div class="hospital-brand">
          <img src="${logoSrc}" alt="Yarsis" class="hospital-logo" />
          <div>
            <h1>${escapeHtml(doc.hospitalName)}</h1>
            <p>${escapeHtml(doc.hospitalAddress)}</p>
            <p>Telp. ${escapeHtml(doc.hospitalPhone)} · ${escapeHtml(doc.hospitalWebsite)}</p>
          </div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="title">RINGKASAN HASIL KONSULTASI</div>
        <div><strong>Jenis Layanan:</strong> ${escapeHtml(doc.serviceLabel)}</div>
        <div><strong>No. Dokumen:</strong> ${escapeHtml(doc.documentNo)}</div>
        <div><strong>Tanggal Selesai:</strong> ${escapeHtml(formatDateId(doc.completedAt))}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Data Pasien</div>
      <div class="grid-2">
        <div class="field"><label>Nama Pasien</label><span>${escapeHtml(doc.patient.name)}</span></div>
        <div class="field"><label>No. Rekam Medis</label><span>${escapeHtml(doc.patient.medicalRecordNumber)}</span></div>
        <div class="field"><label>Tanggal Lahir / Usia</label><span>${escapeHtml(doc.patient.birthDate ? formatDateShort(doc.patient.birthDate) : "-")}${doc.patient.age ? ` (${escapeHtml(doc.patient.age)})` : ""}</span></div>
        <div class="field"><label>Jenis Kelamin</label><span>${escapeHtml(doc.patient.sex ?? "-")}</span></div>
        <div class="field" style="grid-column: 1 / -1"><label>Alamat</label><span>${escapeHtml(doc.patient.address ?? "-")}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Data Tenaga Kesehatan</div>
      <div class="grid-2">
        <div class="field"><label>Nama ${escapeHtml(doc.providerLabel)}</label><span>${escapeHtml(doc.provider.name)}</span></div>
        <div class="field"><label>Poli / Unit</label><span>${escapeHtml(doc.provider.unitName ?? "-")}</span></div>
        ${doc.scheduleDate ? `<div class="field"><label>Tanggal Praktik</label><span>${escapeHtml(doc.scheduleDate)}</span></div>` : ""}
        ${doc.provider.sip ? `<div class="field"><label>No. SIP</label><span>${escapeHtml(doc.provider.sip)}</span></div>` : ""}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Keluhan Utama</div>
      <div class="content-box">${escapeHtml(doc.complaint ?? "-")}</div>
    </div>

    ${
      doc.triageSummary
        ? `<div class="section"><div class="section-title">Ringkasan Triage</div><div class="content-box">${escapeHtml(doc.triageSummary)}</div></div>`
        : ""
    }

    ${
      doc.summaryText
        ? `<div class="section"><div class="section-title">Ringkasan Hasil Konsultasi</div><div class="content-box">${escapeHtml(doc.summaryText)}</div></div>`
        : ""
    }

    ${
      doc.keyFindings && doc.keyFindings.length > 0
        ? `<div class="section"><div class="section-title">Temuan Utama</div><div class="content-box"><ul>${doc.keyFindings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></div>`
        : ""
    }

    <div class="section">
      <div class="section-title">Catatan Konsultasi</div>
      <div class="content-box">
        ${
          notes
            ? notes
            : `<div class="note-text">Tidak ada catatan tambahan dari tenaga kesehatan.</div>`
        }
      </div>
    </div>

    ${
      rx
        ? `<div class="section">
            <div class="section-title">Diagnosis &amp; Resep</div>
            <div class="content-box">
              <div><strong>Diagnosis:</strong> ${escapeHtml(rx.diagnosis)}</div>
              ${rx.icd10 ? `<div style="margin-top:4px;font-size:11px;color:#6b7280">ICD-10: ${escapeHtml(rx.icd10)}</div>` : ""}
              ${rx.prescriptionNo ? `<div style="margin-top:6px;font-size:11px;color:#6b7280">No. Resep: ${escapeHtml(rx.prescriptionNo)}</div>` : ""}
              ${
                rx.medications.length
                  ? `<div style="margin-top:8px"><strong>Obat:</strong><ul style="margin-top:4px">${rx.medications.map(medicationLine).join("")}</ul></div>`
                  : ""
              }
            </div>
          </div>`
        : ""
    }

    ${
      doc.advice
        ? `<div class="section"><div class="section-title">Anjuran / Edukasi Pasien</div><div class="advice">${escapeHtml(doc.advice)}</div></div>`
        : ""
    }

    ${
      rx?.followUp
        ? `<div class="section"><div class="section-title">Kontrol Ulang</div><div class="advice">${escapeHtml(rx.followUp)}</div></div>`
        : ""
    }

    <div class="footer">
      <div class="verify">
        <div><strong>Verifikasi Ringkasan Digital DARSI</strong></div>
        <div>Kode verifikasi:</div>
        <code>${escapeHtml(doc.verificationCode)}</code>
        <div style="margin-top:6px">Dokumen ini diterbitkan otomatis setelah konsultasi selesai melalui sistem DARSI RSI A. Yani.</div>
      </div>
      <div class="signature">
        <div>Surabaya, ${escapeHtml(formatDateId(doc.completedAt))}</div>
        <div class="sign-line"></div>
        <div><strong>${escapeHtml(doc.provider.name)}</strong></div>
        <div>${escapeHtml(doc.provider.sip ?? `${doc.providerLabel} Penanggung Jawab`)}</div>
        <div class="stamp">DARSI E-CONSULTATION</div>
      </div>
    </div>

    <div class="disclaimer">
      Ringkasan hasil konsultasi elektronik ini merupakan dokumentasi pelayanan telekonsultasi DARSI RSI A. Yani dan bukan pengganti pemeriksaan fisik langsung.
      Pasien disarankan datang ke fasilitas kesehatan atau IGD bila gejala memburuk, demikian pula mengikuti rencana kontrol yang dianjurkan.
      Dokumen ini sah selama sesuai dengan catatan rekam medis di rumah sakit.
    </div>
  </div>
</body>
</html>`;
}
