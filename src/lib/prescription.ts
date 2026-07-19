import { createHash, randomBytes } from "crypto";
import { dbQuery } from "@/src/lib/db";
import { resolveDarsiPublicUrl } from "@/src/config/site";
import { yarsisLogoPublicUrl } from "@/src/lib/yarsis-logo-asset";
import {
  DOCUMENT_SCREEN_MOBILE_CSS,
  documentStandaloneSaveToolbarHtml,
  documentToolbarCss,
  type DocumentHtmlOptions,
} from "@/src/lib/document-html-layout";
import type {
  ConsultationPrescription,
  PrescriptionDocumentData,
  PrescriptionMedication,
  PrescriptionPatientInfo,
  PrescriptionDoctorInfo,
  SavePrescriptionInput,
} from "@/src/types/prescription";

const HOSPITAL = {
  name: "RS Islam Surabaya (RSI) A. Yani",
  address: "Jl. Ahmad Yani No. 2-4, Surabaya 60231, Jawa Timur",
  phone: "(031) 8284505",
  website: "www.rsisurabaya.com",
  logoUrl: "/logos/yarsis-logo.png",
} as const;

export function emptyMedication(): PrescriptionMedication {
  return {
    name: "",
    strength: "",
    dosage: "1 tablet",
    frequency: "3x sehari",
    route: "Oral",
    duration: "5 hari",
    quantity: "",
    notes: "",
  };
}

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

function formatDateId(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function verificationCode(prescriptionNo: string, sessionId: number) {
  return createHash("sha256")
    .update(`${prescriptionNo}:${sessionId}:darsi-rsi`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

function prescriptionNo(sessionId: number) {
  const year = new Date().getFullYear();
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `RX-${year}-${String(sessionId).padStart(5, "0")}-${suffix}`;
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

function escapeHtml(value: unknown) {
  return toText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function validatePrescriptionInput(input: SavePrescriptionInput) {
  if (!input.diagnosis.trim()) {
    throw new Error("Diagnosis wajib diisi");
  }
  if (!input.validUntil) {
    throw new Error("Tanggal berlaku resep wajib diisi");
  }
  const meds = input.medications.filter((m) => m.name.trim());
  if (meds.length === 0) {
    throw new Error("Minimal satu obat wajib diisi");
  }
  for (const med of meds) {
    if (!med.dosage.trim() || !med.frequency.trim() || !med.duration.trim()) {
      throw new Error(`Lengkapi dosis, frekuensi, dan durasi untuk ${med.name}`);
    }
  }
  return meds;
}

type PatientRow = {
  nama: string | null;
  no_rm: string;
  tgl_lahir: string | null;
  sex: string | null;
  alamat: string | null;
};

type MetaRow = {
  doctor_name: string | null;
  unit_name: string | null;
  prescription: unknown;
};

export async function getSessionPrescription(sessionId: number) {
  const result = await dbQuery<{ prescription: ConsultationPrescription | null }>(
    `select prescription from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  return (result.rows[0]?.prescription as ConsultationPrescription | null) ?? null;
}

const PRESCRIPTION_SESSION_TYPES = new Set([
  "doctor_consultation",
  "midwife_consultation",
  "nurse_consultation",
]);

/** Verifikasi pasien boleh mengakses resep sesi dokter/bidan. */
export async function verifyPatientPrescriptionAccess(sessionId: number, patientId: number) {
  const result = await dbQuery<{ patient_id: number | null; session_type: string }>(
    `select patient_id, session_type from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Sesi tidak ditemukan");
  if (row.patient_id !== patientId) throw new Error("Sesi bukan milik pasien ini");
  if (!PRESCRIPTION_SESSION_TYPES.has(row.session_type)) {
    throw new Error("Tipe sesi tidak mendukung resep");
  }
  return row;
}

export async function getPrescriptionsForSessions(sessionIds: number[]) {
  if (sessionIds.length === 0) return new Map<number, ConsultationPrescription>();
  const result = await dbQuery<{ session_id: number; prescription: ConsultationPrescription }>(
    `select session_id, prescription
     from doctor_consultation_meta
     where session_id = any($1::int[])
       and prescription is not null`,
    [sessionIds]
  );
  const map = new Map<number, ConsultationPrescription>();
  for (const row of result.rows) {
    if (row.prescription) map.set(row.session_id, row.prescription);
  }
  return map;
}

export async function buildPrescriptionDocument(
  sessionId: number,
  patientId: number
): Promise<PrescriptionDocumentData | null> {
  const prescription = await getSessionPrescription(sessionId);
  if (!prescription) return null;

  const patientResult = await dbQuery<PatientRow>(
    `select nama, no_rm, tgl_lahir, sex, alamat
     from pasienkonsul.b_ms_pasien where id = $1 limit 1`,
    [patientId]
  );
  const metaResult = await dbQuery<MetaRow>(
    `select doctor_name, unit_name, prescription
     from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  const patient = patientResult.rows[0];
  const meta = metaResult.rows[0];
  if (!patient) return null;

  const patientInfo: PrescriptionPatientInfo = {
    name: patient.nama ?? "Pasien",
    medicalRecordNumber: toText(patient.no_rm) || "-",
    birthDate: patient.tgl_lahir,
    sex: formatSex(patient.sex),
    address: patient.alamat,
    age: calcAge(patient.tgl_lahir),
  };

  const doctor: PrescriptionDoctorInfo = {
    name: meta?.doctor_name ?? prescription.issuedBy,
    unitName: meta?.unit_name,
    sip: prescription.doctorSip,
  };

  return {
    prescription,
    patient: patientInfo,
    doctor,
    hospitalName: HOSPITAL.name,
    hospitalAddress: HOSPITAL.address,
    hospitalPhone: HOSPITAL.phone,
    hospitalWebsite: HOSPITAL.website,
  };
}

export async function saveSessionPrescription(input: {
  sessionId: number;
  actor: string;
  data: SavePrescriptionInput;
}) {
  const medications = validatePrescriptionInput(input.data);
  const issuedAt = new Date().toISOString();
  const no = prescriptionNo(input.sessionId);
  const code = verificationCode(no, input.sessionId);

  const prescription: ConsultationPrescription = {
    prescriptionNo: no,
    sessionId: input.sessionId,
    diagnosis: input.data.diagnosis.trim(),
    icd10: input.data.icd10?.trim() || undefined,
    medications,
    generalAdvice: input.data.generalAdvice?.trim() || undefined,
    followUp: input.data.followUp?.trim() || undefined,
    patientWeight: input.data.patientWeight?.trim() || undefined,
    validUntil: input.data.validUntil,
    doctorSip: input.data.doctorSip?.trim() || undefined,
    issuedAt,
    issuedBy: input.actor,
    verificationCode: code,
    status: "issued",
  };

  await dbQuery(
    `update doctor_consultation_meta
     set prescription = $2::jsonb, updated_at = current_timestamp
     where session_id = $1`,
    [input.sessionId, JSON.stringify(prescription)]
  );

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text)
     values ($1, 'system', $2)`,
    [
      input.sessionId,
      `Tenaga medis telah menerbitkan resep digital No. ${no}. Unduh resep melalui kartu resep di bawah percakapan.`,
    ]
  );

  return prescription;
}

function medicationBlock(med: PrescriptionMedication, index: number) {
  const strength = med.strength ? ` ${escapeHtml(med.strength)}` : "";
  const qty = med.quantity ? `<div class="rx-line">No. ${escapeHtml(med.quantity)}</div>` : "";
  const notes = med.notes
    ? `<div class="rx-note">Catatan: ${escapeHtml(med.notes)}</div>`
    : "";

  return `
    <div class="rx-item">
      <div class="rx-index">R/</div>
      <div class="rx-body">
        <div class="rx-drug">${index + 1}. ${escapeHtml(med.name)}${strength}</div>
        ${qty}
        <div class="rx-line">S. ${escapeHtml(med.dosage)}, ${escapeHtml(med.frequency)}, ${escapeHtml(med.route)}, selama ${escapeHtml(med.duration)}</div>
        ${notes}
      </div>
    </div>
  `;
}

export function renderPrescriptionHtml(doc: PrescriptionDocumentData, options?: DocumentHtmlOptions) {
  const { prescription: rx, patient, doctor } = doc;
  const meds = rx.medications.map((m, i) => medicationBlock(m, i)).join("");
  const logoUrl = options?.inlineLogoDataUri ?? yarsisLogoPublicUrl(resolveDarsiPublicUrl(process.env.DARSI_PUBLIC_URL));
  const embed = options?.embed === true;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resep ${escapeHtml(rx.prescriptionNo)}</title>
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
    .diagnosis {
      border: 1px solid #d1d5db; border-radius: 8px;
      padding: 10px 12px; font-size: 12px; background: #f9fafb;
    }
    .rx-box {
      border: 1px solid #d1d5db; border-radius: 8px;
      padding: 12px 14px; margin-top: 8px; background: #fff;
    }
    .rx-item { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #e5e7eb; }
    .rx-item:last-child { border-bottom: none; }
    .rx-index { font-weight: 700; color: #047857; width: 24px; }
    .rx-drug { font-weight: 700; font-size: 13px; }
    .rx-line, .rx-note { font-size: 12px; margin-top: 3px; color: #374151; }
    .rx-note { font-style: italic; color: #6b7280; }
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
          <img src="${logoUrl}" alt="Yarsis" class="hospital-logo" />
          <div>
            <h1>${escapeHtml(doc.hospitalName)}</h1>
            <p>${escapeHtml(doc.hospitalAddress)}</p>
            <p>Telp. ${escapeHtml(doc.hospitalPhone)} · ${escapeHtml(doc.hospitalWebsite)}</p>
          </div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="title">RESEP OBAT ELEKTRONIK</div>
        <div><strong>No. Resep:</strong> ${escapeHtml(rx.prescriptionNo)}</div>
        <div><strong>Tanggal:</strong> ${escapeHtml(formatDateId(rx.issuedAt))}</div>
        <div><strong>Berlaku s/d:</strong> ${escapeHtml(formatDateShort(rx.validUntil))}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Data Pasien</div>
      <div class="grid-2">
        <div class="field"><label>Nama Pasien</label><span>${escapeHtml(patient.name)}</span></div>
        <div class="field"><label>No. Rekam Medis</label><span>${escapeHtml(patient.medicalRecordNumber)}</span></div>
        <div class="field"><label>Tanggal Lahir / Usia</label><span>${escapeHtml(patient.birthDate ? formatDateShort(patient.birthDate) : "-")}${patient.age ? ` (${escapeHtml(patient.age)})` : ""}</span></div>
        <div class="field"><label>Jenis Kelamin</label><span>${escapeHtml(patient.sex ?? "-")}</span></div>
        ${rx.patientWeight ? `<div class="field"><label>Berat Badan</label><span>${escapeHtml(rx.patientWeight)}</span></div>` : ""}
        <div class="field" style="grid-column: 1 / -1"><label>Alamat</label><span>${escapeHtml(patient.address ?? "-")}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Data Dokter</div>
      <div class="grid-2">
        <div class="field"><label>Nama Dokter</label><span>${escapeHtml(doctor.name)}</span></div>
        <div class="field"><label>Poli / Unit</label><span>${escapeHtml(doctor.unitName ?? "-")}</span></div>
        <div class="field"><label>No. SIP</label><span>${escapeHtml(doctor.sip ?? rx.doctorSip ?? "-")}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Diagnosis</div>
      <div class="diagnosis">
        <strong>${escapeHtml(rx.diagnosis)}</strong>
        ${rx.icd10 ? `<div style="margin-top:4px;font-size:11px;color:#6b7280">ICD-10: ${escapeHtml(rx.icd10)}</div>` : ""}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Resep Obat (R/)</div>
      <div class="rx-box">${meds}</div>
    </div>

    ${
      rx.generalAdvice
        ? `<div class="section"><div class="section-title">Anjuran / Edukasi Pasien</div><div class="advice">${escapeHtml(rx.generalAdvice)}</div></div>`
        : ""
    }
    ${
      rx.followUp
        ? `<div class="section"><div class="section-title">Kontrol Ulang</div><div class="advice">${escapeHtml(rx.followUp)}</div></div>`
        : ""
    }

    <div class="footer">
      <div class="verify">
        <div><strong>Verifikasi Resep Digital DARSI</strong></div>
        <div>Kode verifikasi:</div>
        <code>${escapeHtml(rx.verificationCode)}</code>
        <div style="margin-top:6px">Resep ini diterbitkan melalui sistem DARSI RSI A. Yani dan dapat diverifikasi di apotek rumah sakit.</div>
      </div>
      <div class="signature">
        <div>Surabaya, ${escapeHtml(formatDateId(rx.issuedAt))}</div>
        <div class="sign-line"></div>
        <div><strong>${escapeHtml(doctor.name)}</strong></div>
        <div>${escapeHtml(doctor.sip ?? rx.doctorSip ?? "SIP. _______________")}</div>
        <div class="stamp">DARSI E-PRESCRIPTION</div>
      </div>
    </div>

    <div class="disclaimer">
      Resep elektronik ini sah sesuai SOP pelayanan resep RSI A. Yani. Obat keras dan psikotropika hanya dapat ditebus sesuai regulasi Kemenkes RI.
      Pasien wajib membawa resep cetak/digital ini beserta identitas diri saat pengambilan obat di Apotek RSI. Resep tidak berlaku apabila telah melewati tanggal kedaluwarsa
      atau terdapat perubahan fisik yang meragukan keabsahannya. Dokter penanggung jawab: ${escapeHtml(doctor.name)}.
    </div>
  </div>
</body>
</html>`;
}

export { HOSPITAL };
