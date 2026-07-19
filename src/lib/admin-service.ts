import { dbQuery } from "@/src/lib/db";

export type AdminOverview = {
  activeDoctors: number;
  activeStaffDoctors: number;
  inactiveStaff: number;
  consultationsToday: number;
  waitingApproval: number;
  activeConsultations: number;
  lastSync: Awaited<ReturnType<typeof import("@/src/lib/rsi-doctor-sync").getLatestSyncRun>>;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const { getLatestSyncRun } = await import("@/src/lib/rsi-doctor-sync");

  const [doctors, staff, sessions, lastSync] = await Promise.all([
    dbQuery<{ count: string }>(
      `select count(*)::text as count from pasienkonsul.darsi_doctor_directory where is_active = true`
    ),
    dbQuery<{ active: string; inactive: string }>(
      `select
         count(*) filter (where is_active and role = 'doctor')::text as active,
         count(*) filter (where not is_active)::text as inactive
       from pasienkonsul.darsi_staff_accounts`
    ),
    dbQuery<{
      today: string;
      waiting: string;
      active: string;
    }>(
      `select
         count(*) filter (where created_at::date = current_date)::text as today,
         count(*) filter (where status = 'waiting_approval')::text as waiting,
         count(*) filter (where status = 'active')::text as active
       from chat_sessions
       where session_type = 'doctor_consultation'`
    ),
    getLatestSyncRun(),
  ]);

  return {
    activeDoctors: Number(doctors.rows[0]?.count ?? 0),
    activeStaffDoctors: Number(staff.rows[0]?.active ?? 0),
    inactiveStaff: Number(staff.rows[0]?.inactive ?? 0),
    consultationsToday: Number(sessions.rows[0]?.today ?? 0),
    waitingApproval: Number(sessions.rows[0]?.waiting ?? 0),
    activeConsultations: Number(sessions.rows[0]?.active ?? 0),
    lastSync,
  };
}

export async function listAdminDoctors() {
  const result = await dbQuery<{
    doctor_code: string;
    doctor_name: string;
    unit_name: string;
    schedule_label: string | null;
    quota_remaining: number | null;
    quota_total: number | null;
    is_active: boolean;
    synced_at: Date | null;
    staff_username: string | null;
    staff_active: boolean | null;
    staff_phone: string | null;
  }>(
    `select d.doctor_code, d.doctor_name, d.unit_name, d.schedule_label,
            d.quota_remaining, d.quota_total, d.is_active, d.synced_at,
            s.username as staff_username, s.is_active as staff_active, s.phone as staff_phone
     from pasienkonsul.darsi_doctor_directory d
     left join pasienkonsul.darsi_staff_accounts s
       on s.doctor_code = d.doctor_code and s.role = 'doctor'
     order by d.is_active desc, d.unit_name, d.doctor_name`
  );

  return result.rows.map((r) => ({
    doctorCode: r.doctor_code,
    doctorName: r.doctor_name,
    unitName: r.unit_name,
    scheduleLabel: r.schedule_label,
    quotaRemaining: r.quota_remaining,
    quotaTotal: r.quota_total,
    isActive: r.is_active,
    syncedAt: r.synced_at?.toISOString() ?? null,
    staffUsername: r.staff_username,
    staffActive: r.staff_active,
    staffPhone: r.staff_phone,
  }));
}

export async function listAdminStaff() {
  const result = await dbQuery<{
    id: number;
    username: string;
    email: string;
    role: string;
    display_name: string;
    doctor_code: string | null;
    unit_name: string | null;
    phone: string | null;
    is_active: boolean;
    created_at: Date;
  }>(
    `select id, username, email, role, display_name, doctor_code, unit_name, phone, is_active, created_at
     from pasienkonsul.darsi_staff_accounts
     order by role, is_active desc, display_name`
  );

  return result.rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    role: r.role,
    displayName: r.display_name,
    doctorCode: r.doctor_code,
    unitName: r.unit_name,
    phone: r.phone,
    isActive: r.is_active,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function listRecentConsultations(limit = 30) {
  const result = await dbQuery<{
    session_id: number;
    session_type: string;
    status: string;
    patient_name: string | null;
    doctor_name: string | null;
    unit_name: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `select cs.id as session_id, cs.session_type, cs.status,
            p.nama as patient_name,
            m.doctor_name, m.unit_name,
            cs.created_at, cs.updated_at
     from chat_sessions cs
     left join pasienkonsul.b_ms_pasien p on p.id = cs.patient_id
     left join doctor_consultation_meta m on m.session_id = cs.id
     where cs.session_type in ('doctor_consultation', 'midwife_consultation')
     order by cs.updated_at desc
     limit $1`,
    [limit]
  );

  return result.rows.map((r) => ({
    sessionId: r.session_id,
    sessionType: r.session_type,
    status: r.status,
    patientName: r.patient_name,
    doctorName: r.doctor_name,
    unitName: r.unit_name,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function updateStaffAccount(
  id: number,
  patch: { isActive?: boolean; phone?: string | null; role?: string }
) {
  const fields: string[] = [];
  const values: unknown[] = [id];
  let i = 2;

  if (patch.isActive !== undefined) {
    fields.push(`is_active = $${i++}`);
    values.push(patch.isActive);
  }
  if (patch.phone !== undefined) {
    fields.push(`phone = $${i++}`);
    values.push(patch.phone);
  }
  if (patch.role !== undefined) {
    fields.push(`role = $${i++}`);
    values.push(patch.role);
  }

  if (fields.length === 0) return null;

  const result = await dbQuery<{ id: number }>(
    `update pasienkonsul.darsi_staff_accounts
     set ${fields.join(", ")}
     where id = $1
     returning id`,
    values
  );
  return result.rows[0]?.id ?? null;
}
