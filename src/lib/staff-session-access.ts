import { dbQuery } from "@/src/lib/db";
import {
  approveDoctorSession,
  rejectDoctorSession,
} from "@/src/lib/doctor-consultation-service";
import {
  approveMidwifeSession,
  rejectMidwifeSession,
} from "@/src/lib/consultation-service";
import type { StaffUser } from "@/src/types/staff";

const MIDWIFE_TYPES = new Set(["midwife_consultation", "nurse_consultation"]);

export type StaffMonitorSession = {
  row: {
    id: number;
    patient_id: number;
    session_type: string;
    status: string;
    initial_complaint: string | null;
  };
  meta: {
    doctor_name: string | null;
    unit_name: string | null;
    monitor_token: string;
    doctor_takeover_active?: boolean | null;
    prescription?: unknown;
  };
  patient: { nama: string | null; no_rm: string } | null;
  sessionKind: "doctor" | "midwife";
};

export async function getSessionKind(sessionId: number): Promise<"doctor" | "midwife" | null> {
  const result = await dbQuery<{ session_type: string }>(
    `select session_type from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const type = result.rows[0]?.session_type;
  if (type === "doctor_consultation") return "doctor";
  if (type && MIDWIFE_TYPES.has(type)) return "midwife";
  return null;
}

export async function getStaffMonitorSession(sessionId: number): Promise<StaffMonitorSession> {
  const sessionResult = await dbQuery<StaffMonitorSession["row"]>(
    `select id, patient_id, session_type, status, initial_complaint
     from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const row = sessionResult.rows[0];
  if (!row) throw new Error("Sesi tidak ditemukan");

  const kind = row.session_type === "doctor_consultation"
    ? "doctor"
    : MIDWIFE_TYPES.has(row.session_type)
      ? "midwife"
      : null;
  if (!kind) throw new Error("Tipe sesi tidak didukung di portal staff");

  const metaResult = await dbQuery<{
    doctor_name: string | null;
    unit_name: string | null;
    monitor_token: string;
    doctor_takeover_active: boolean | null;
    prescription: unknown;
  }>(
    `select doctor_name, unit_name, monitor_token, doctor_takeover_active, prescription
     from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  const metaRow = metaResult.rows[0];
  if (!metaRow?.monitor_token) throw new Error("Metadata sesi tidak ditemukan");

  const patientResult = await dbQuery<{ nama: string | null; no_rm: string }>(
    `select nama, no_rm from pasienkonsul.b_ms_pasien where id = $1 limit 1`,
    [row.patient_id]
  );

  return {
    row,
    meta: {
      doctor_name: metaRow.doctor_name,
      unit_name: metaRow.unit_name,
      monitor_token: metaRow.monitor_token,
      doctor_takeover_active: metaRow.doctor_takeover_active,
      prescription: metaRow.prescription,
    },
    patient: patientResult.rows[0] ?? null,
    sessionKind: kind,
  };
}

export async function staffCanAccessSession(staff: StaffUser, sessionId: number): Promise<boolean> {
  const sessionResult = await dbQuery<{ session_type: string }>(
    `select session_type from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const sessionType = sessionResult.rows[0]?.session_type;
  if (!sessionType) return false;

  const metaResult = await dbQuery<{ assigned_staff_id: number | null; doctor_code: string | null }>(
    `select assigned_staff_id, doctor_code from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  const meta = metaResult.rows[0];
  if (!meta) return false;

  if (meta.assigned_staff_id) {
    return meta.assigned_staff_id === staff.id;
  }

  if (staff.role === "nurse") {
    return MIDWIFE_TYPES.has(sessionType);
  }

  if (staff.role === "doctor") {
    if (sessionType !== "doctor_consultation") return false;
    if (staff.notifyAll) return true;
    return Boolean(staff.doctorCode && meta.doctor_code === staff.doctorCode);
  }

  return staff.notifyAll;
}

export async function approveStaffSession(sessionId: number, actor: string) {
  const kind = await getSessionKind(sessionId);
  if (kind === "doctor") return approveDoctorSession(sessionId, actor);
  if (kind === "midwife") return approveMidwifeSession(sessionId, actor);
  throw new Error("Sesi tidak dapat disetujui");
}

export async function rejectStaffSession(sessionId: number, actor: string, reason?: string) {
  const kind = await getSessionKind(sessionId);
  if (kind === "doctor") return rejectDoctorSession(sessionId, reason, actor);
  if (kind === "midwife") return rejectMidwifeSession(sessionId, reason, actor);
  throw new Error("Sesi tidak dapat ditolak");
}
