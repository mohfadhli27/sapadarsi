import { dbQuery } from "@/src/lib/db";
import type { StaffNotification } from "@/src/types/staff";
import { findStaffIdByDoctorCode } from "@/src/lib/doctor-directory";

type NotificationRow = {
  id: number;
  session_id: number;
  type: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: Date | null;
  created_at: Date;
};

function mapNotification(row: NotificationRow): StaffNotification {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkPath: row.link_path,
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

async function notifyStaffById(
  staffId: number,
  input: {
    sessionId: number;
    type: string;
    title: string;
    body: string;
    linkPath: string;
  }
) {
  await dbQuery(
    `insert into pasienkonsul.staff_notifications
       (staff_id, session_id, type, title, body, link_path)
     values ($1, $2, $3, $4, $5, $6)`,
    [staffId, input.sessionId, input.type, input.title, input.body, input.linkPath]
  );
}

async function notifyStaffIds(
  staffIds: number[],
  input: {
    sessionId: number;
    type: string;
    title: string;
    body: string;
    linkPath: string;
  }
) {
  const unique = [...new Set(staffIds)];
  for (const staffId of unique) {
    await notifyStaffById(staffId, input);
  }
  return unique.length;
}

export async function notifyStaffConsultationRequest(input: {
  sessionId: number;
  doctorCode: string;
  patientName: string;
  patientRm: string;
  complaint: string;
  doctorName: string;
  unitName: string;
  roleLabel?: string;
}) {
  const linkPath = `/staff/consultations/${input.sessionId}?tab=approval`;
  const title = `Permintaan konsultasi ${input.roleLabel ?? "dokter"}`;
  const body = `${input.patientName} (${input.patientRm}) — ${input.complaint.slice(0, 120)}. ${input.unitName}`;

  const staffId = await findStaffIdByDoctorCode(input.doctorCode);
  if (staffId) {
    await notifyStaffById(staffId, {
      sessionId: input.sessionId,
      type: "consultation_request",
      title,
      body,
      linkPath,
    });
    return 1;
  }

  if (/bidan|perawat|nurse|midwife/i.test(input.doctorCode) || input.roleLabel === "Bidan") {
    return notifyAllActiveNurses({
      sessionId: input.sessionId,
      title,
      body,
      linkPath,
    });
  }

  const fallback = await dbQuery<{ id: number }>(
    `select id from pasienkonsul.darsi_staff_accounts
     where role = 'doctor' and is_active = true and notify_all = true
     limit 5`
  );
  await notifyStaffIds(
    fallback.rows.map((r) => r.id),
    { sessionId: input.sessionId, type: "consultation_request", title, body, linkPath }
  );
  return fallback.rows.length;
}

async function notifyAllActiveNurses(input: {
  sessionId: number;
  title: string;
  body: string;
  linkPath: string;
}) {
  const result = await dbQuery<{ id: number }>(
    `select id from pasienkonsul.darsi_staff_accounts
     where role = 'nurse' and is_active = true and notify_all = true`
  );
  return notifyStaffIds(
    result.rows.map((r) => r.id),
    {
      sessionId: input.sessionId,
      type: "consultation_request",
      title: input.title,
      body: input.body,
      linkPath: input.linkPath,
    }
  );
}

export async function notifyStaffPatientMessage(input: {
  sessionId: number;
  doctorCode: string | null;
  patientName: string;
  messagePreview: string;
}) {
  const linkPath = `/staff/consultations/${input.sessionId}`;
  const payload = {
    sessionId: input.sessionId,
    type: "patient_message",
    title: `Pesan baru dari ${input.patientName}`,
    body: input.messagePreview.slice(0, 200),
    linkPath,
  };

  if (!input.doctorCode) {
    return notifyAllActiveNurses({
      sessionId: input.sessionId,
      title: payload.title,
      body: payload.body,
      linkPath,
    });
  }

  const staffId = await findStaffIdByDoctorCode(input.doctorCode);
  if (staffId) {
    await notifyStaffById(staffId, payload);
    return 1;
  }
  return 0;
}

export async function listStaffNotifications(staffId: number, limit = 50) {
  const result = await dbQuery<NotificationRow>(
    `select n.id, n.session_id, n.type, n.title, n.body, n.link_path, n.read_at, n.created_at
     from pasienkonsul.staff_notifications n
     join doctor_consultation_meta dcm on dcm.session_id = n.session_id
     where n.staff_id = $1
       and (dcm.assigned_staff_id = $1 or dcm.assigned_staff_id is null)
     order by n.created_at desc
     limit $2`,
    [staffId, limit]
  );
  return result.rows.map(mapNotification);
}

export async function countUnreadNotifications(staffId: number) {
  const result = await dbQuery<{ count: string }>(
    `select count(*)::text as count
     from pasienkonsul.staff_notifications n
     join doctor_consultation_meta dcm on dcm.session_id = n.session_id
     where n.staff_id = $1 and n.read_at is null
       and (dcm.assigned_staff_id = $1 or dcm.assigned_staff_id is null)`,
    [staffId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function markNotificationRead(staffId: number, notificationId: number) {
  await dbQuery(
    `update pasienkonsul.staff_notifications
     set read_at = current_timestamp
     where id = $1 and staff_id = $2`,
    [notificationId, staffId]
  );
}

export async function markAllNotificationsRead(staffId: number) {
  await dbQuery(
    `update pasienkonsul.staff_notifications
     set read_at = current_timestamp
     where staff_id = $1 and read_at is null`,
    [staffId]
  );
}

export { staffCanAccessSession } from "@/src/lib/staff-session-access";
