import { dbQuery } from "@/src/lib/db";
import { hashPassword } from "@/src/lib/password";
import { DEMO_PROTECTED_STAFF_USERNAMES } from "@/src/config/demo-accounts";
import type { RsiUnit } from "@/src/lib/rsi-api";

const RSI_BASE = process.env.RSI_API_BASE_URL ?? "https://api.rsisurabaya.com:8008";

export const RSI_TARGET_POLIS = [
  "Spesialis Penyakit Dalam",
  "Spesialis Anak",
  "Spesialis THT",
  "Spesialis Mata",
  "Spesialis Jantung",
] as const;

const LEGACY_FAKE_CODES = [
  "RSI-PD-DR-ANDI",
  "RSI-AN-DR-MAYA",
  "RSI-THT-DR-BUDI",
  "RSI-MT-DR-RINA",
  "RSI-JT-DR-HENDRA",
  "DARSI-UMUM-001",
];

const LEGACY_USERNAMES = [
  "dr_andi_wijaya",
  "dr_maya_sari",
  "dr_budi_prasetyo",
  "dr_rina_kusuma",
  "dr_hendra_gunawan",
  "dokter_umum",
  "dr_andi_roesbiantoro",
  "dr_bony_pramono",
  "dr_novia_kusumawardhani",
  "dr_sheila_nalia",
  "dr_vita_pradiptya",
];

export type SyncDoctorSlot = {
  doctorCode: string;
  doctorName: string;
  unitId: string;
  unitName: string;
  rumpun: string;
  scheduleDate: string;
  scheduleLabel: string | null;
  quotaRemaining: number;
  quotaTotal: number | null;
  nameKey: string;
  username: string;
  email: string;
};

export type DoctorSyncResult = {
  success: boolean;
  scheduleDate: string;
  doctorsSynced: number;
  doctorsCreated: number;
  doctorsUpdated: number;
  doctorsDeactivated: number;
  poliStats: Array<{ poli: string; count: number; error?: string }>;
  errors: string[];
  durationMs: number;
  runId?: number;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDoctorNameKey(name: string) {
  return name
    .toLowerCase()
    .replace(/^(prof\.|dr\.|drg\.)\s*/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildUsername(doctorName: string) {
  const key = normalizeDoctorNameKey(doctorName);
  return `dr_${key.slice(0, 48)}`;
}

function buildEmail(username: string) {
  return `${username.replace(/^dr_/, "")}@dokter.rsi-ayani.id`;
}

function parseQuotaRow(
  row: Record<string, unknown>,
  unit: RsiUnit,
  scheduleDate: string
): SyncDoctorSlot | null {
  const dokterField = row.dokter;
  const nestedName =
    typeof dokterField === "object" && dokterField !== null
      ? String((dokterField as { nama?: string }).nama ?? "").trim()
      : typeof dokterField === "string"
        ? dokterField.trim()
        : "";

  const doctorName = String(
    nestedName || row.nama_dokter || row.nama || row.DoctorName || ""
  ).trim();

  let doctorCode = String(
    row.kode_dokter ?? row.id_dokter ?? row.id ?? row.DoctorId ?? ""
  ).trim();
  if (!doctorName) return null;
  if (!doctorCode) doctorCode = `JADWAL-${normalizeDoctorNameKey(doctorName)}`;

  const bpjs = (row.bpjs ?? {}) as { sisa?: number; kuota?: number };
  const umum = (row.umum ?? {}) as { sisa?: number; kuota?: number };
  const quotaRemaining = Number(
    bpjs.sisa ?? umum.sisa ?? row.sisa_kuota ?? row.kuota_sisa ?? row.sisa ?? 0
  );
  if (!Number.isFinite(quotaRemaining) || quotaRemaining <= 0) return null;

  const username = buildUsername(doctorName);

  return {
    doctorCode,
    doctorName,
    unitId: unit.id,
    unitName: unit.nama,
    rumpun: unit.rumpun,
    scheduleDate,
    scheduleLabel:
      String(row.jam_praktek ?? row.jam ?? row.jadwal ?? row.schedule ?? "").trim() ||
      null,
    quotaRemaining,
    quotaTotal: Number(row.kuota ?? bpjs.kuota ?? row.total_kuota ?? 0) || null,
    nameKey: normalizeDoctorNameKey(doctorName),
    username,
    email: buildEmail(username),
  };
}

async function fetchRsiUnits(): Promise<RsiUnit[]> {
  const res = await fetch(`${RSI_BASE.replace(/\/$/, "")}/units/reguler`, {
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json();
  if (!res.ok || data.metadata?.status === false) {
    throw new Error(data.metadata?.message ?? `Units API error (${res.status})`);
  }
  return data.response ?? [];
}

async function fetchRsiQuota(unitId: string, tanggal: string) {
  const body = new URLSearchParams({ unit_id: unitId, date: tanggal });
  const res = await fetch(`${RSI_BASE.replace(/\/$/, "")}/quota`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json();
  if (!res.ok || data.metadata?.status === false) {
    throw new Error(data.metadata?.message ?? `Quota API error (${res.status})`);
  }
  const raw = data.response;
  return (Array.isArray(raw) ? raw : raw?.data ?? []) as Record<string, unknown>[];
}

async function startSyncRun(input: {
  scheduleDate: string;
  triggeredBy: string;
  staffId?: number;
}) {
  const result = await dbQuery<{ id: number }>(
    `insert into pasienkonsul.darsi_sync_runs
       (sync_type, status, schedule_date, triggered_by, staff_id, started_at)
     values ('doctor_rsi', 'running', $1::date, $2, $3, current_timestamp)
     returning id`,
    [input.scheduleDate, input.triggeredBy, input.staffId ?? null]
  );
  return result.rows[0]!.id;
}

async function finishSyncRun(
  runId: number,
  result: Omit<DoctorSyncResult, "runId" | "durationMs"> & { durationMs: number }
) {
  await dbQuery(
    `update pasienkonsul.darsi_sync_runs
     set status = $2,
         doctors_synced = $3,
         doctors_created = $4,
         doctors_deactivated = $5,
         error_message = $6,
         details = $7::jsonb,
         finished_at = current_timestamp
     where id = $1`,
    [
      runId,
      result.success ? "success" : "failed",
      result.doctorsSynced,
      result.doctorsCreated,
      result.doctorsDeactivated,
      result.errors[0] ?? null,
      JSON.stringify({ poliStats: result.poliStats, errors: result.errors }),
    ]
  );
}

export async function syncDoctorsFromRsi(input?: {
  triggeredBy?: string;
  staffId?: number;
  scheduleDate?: string;
}): Promise<DoctorSyncResult> {
  const started = Date.now();
  const triggeredBy = input?.triggeredBy ?? "manual";
  const scheduleDate = input?.scheduleDate ?? todayIsoDate();
  const defaultPassword =
    process.env.RSI_DEFAULT_DOCTOR_PASSWORD?.trim() || "DemoPass@ChangeMe";
  const passwordHash = hashPassword(defaultPassword);
  const testPhone = process.env.RSI_TEST_DOCTOR_PHONE?.trim() || "082111410063";
  const testDoctorKey =
    process.env.RSI_TEST_DOCTOR_KEY?.trim() || "vivindetrianaspa";

  const poliStats: DoctorSyncResult["poliStats"] = [];
  const errors: string[] = [];
  let runId: number | undefined;

  try {
    runId = await startSyncRun({
      scheduleDate,
      triggeredBy,
      staffId: input?.staffId,
    });

    const units = await fetchRsiUnits();
    const byCode = new Map<string, SyncDoctorSlot>();

    for (const poliName of RSI_TARGET_POLIS) {
      const unit = units.find((u) => u.nama === poliName);
      if (!unit) {
        poliStats.push({ poli: poliName, count: 0, error: "Unit tidak ditemukan" });
        continue;
      }
      try {
        const rows = await fetchRsiQuota(unit.id, scheduleDate);
        const parsed = rows
          .map((r) => parseQuotaRow(r, unit, scheduleDate))
          .filter((v): v is SyncDoctorSlot => v !== null);
        for (const slot of parsed) byCode.set(slot.doctorCode, slot);
        poliStats.push({ poli: poliName, count: parsed.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal quota";
        poliStats.push({ poli: poliName, count: 0, error: msg });
        errors.push(`${poliName}: ${msg}`);
      }
    }

    const synced = [...byCode.values()];
    if (synced.length === 0) {
      throw new Error("Tidak ada dokter aktif dari API RSI hari ini.");
    }

    let doctorsCreated = 0;
    let doctorsUpdated = 0;
    const activeCodes = synced.map((s) => s.doctorCode);

    for (const slot of synced) {
      const phone = slot.nameKey === testDoctorKey ? testPhone : null;

      const existingStaff = await dbQuery<{ id: number }>(
        `select id from pasienkonsul.darsi_staff_accounts where username = $1 limit 1`,
        [slot.username]
      );
      const isNew = !existingStaff.rows[0];
      if (isNew) doctorsCreated++;
      else doctorsUpdated++;

      await dbQuery(
        `insert into pasienkonsul.darsi_doctor_directory
           (doctor_code, doctor_name, unit_id, unit_name, rumpun, unit_type,
            schedule_label, quota_remaining, quota_total, synced_at, updated_at, is_active)
         values ($1,$2,$3,$4,$5,'reguler',$6,$7,$8, current_timestamp, current_timestamp, true)
         on conflict (doctor_code) do update set
           doctor_name = excluded.doctor_name,
           unit_id = excluded.unit_id,
           unit_name = excluded.unit_name,
           rumpun = excluded.rumpun,
           schedule_label = excluded.schedule_label,
           quota_remaining = excluded.quota_remaining,
           quota_total = excluded.quota_total,
           synced_at = current_timestamp,
           updated_at = current_timestamp,
           is_active = true`,
        [
          slot.doctorCode,
          slot.doctorName,
          slot.unitId,
          slot.unitName,
          slot.rumpun,
          slot.scheduleLabel,
          slot.quotaRemaining,
          slot.quotaTotal,
        ]
      );

      await dbQuery(
        `insert into pasienkonsul.darsi_staff_accounts
           (email, username, password_hash, role, doctor_code, display_name, unit_name, phone, notify_all, is_active)
         values ($1,$2,$3,'doctor',$4,$5,$6,$7,false,true)
         on conflict (username) do update set
           email = excluded.email,
           doctor_code = excluded.doctor_code,
           display_name = excluded.display_name,
           unit_name = excluded.unit_name,
           phone = coalesce(excluded.phone, pasienkonsul.darsi_staff_accounts.phone),
           is_active = true`,
        [
          slot.email,
          slot.username,
          passwordHash,
          slot.doctorCode,
          slot.doctorName,
          slot.unitName,
          phone,
        ]
      );
    }

    await dbQuery(
      `update pasienkonsul.darsi_staff_accounts set is_active = false, phone = null
       where (doctor_code = any($1::text[]) or username = any($2::text[]))
         and not (username = any($3::text[]))`,
      [LEGACY_FAKE_CODES, LEGACY_USERNAMES, [...DEMO_PROTECTED_STAFF_USERNAMES]]
    );
    await dbQuery(
      `update pasienkonsul.darsi_doctor_directory set is_active = false
       where doctor_code = any($1::text[])`,
      [LEGACY_FAKE_CODES]
    );

    const deactivated = await dbQuery<{ count: string }>(
      `with dir as (
         update pasienkonsul.darsi_doctor_directory
         set is_active = false, updated_at = current_timestamp
         where doctor_code like 'JADWAL-%'
           and is_active = true
           and doctor_code <> all($1::text[])
         returning doctor_code
       ),
       staff as (
         update pasienkonsul.darsi_staff_accounts s
         set is_active = false
         from dir
         where s.doctor_code = dir.doctor_code
           and s.role = 'doctor'
         returning s.id
       )
       select (select count(*)::text from dir) as count`,
      [activeCodes]
    );
    const doctorsDeactivated = Number(deactivated.rows[0]?.count ?? 0);

    await dbQuery(
      `update pasienkonsul.darsi_staff_accounts
       set phone = null
       where phone = $1 and doctor_code is distinct from $2`,
      [testPhone, `JADWAL-${testDoctorKey}`]
    );

    const result: DoctorSyncResult = {
      success: true,
      scheduleDate,
      doctorsSynced: synced.length,
      doctorsCreated,
      doctorsUpdated,
      doctorsDeactivated,
      poliStats,
      errors,
      durationMs: Date.now() - started,
      runId,
    };

    if (runId) await finishSyncRun(runId, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sinkronisasi gagal";
    errors.push(message);
    const result: DoctorSyncResult = {
      success: false,
      scheduleDate,
      doctorsSynced: 0,
      doctorsCreated: 0,
      doctorsUpdated: 0,
      doctorsDeactivated: 0,
      poliStats,
      errors,
      durationMs: Date.now() - started,
      runId,
    };
    if (runId) await finishSyncRun(runId, result);
    return result;
  }
}

export async function getLatestSyncRun() {
  const result = await dbQuery<{
    id: number;
    status: string;
    schedule_date: string | null;
    doctors_synced: number;
    doctors_created: number;
    doctors_deactivated: number;
    triggered_by: string | null;
    error_message: string | null;
    started_at: Date;
    finished_at: Date | null;
  }>(
    `select id, status, schedule_date, doctors_synced, doctors_created, doctors_deactivated,
            triggered_by, error_message, started_at, finished_at
     from pasienkonsul.darsi_sync_runs
     where sync_type = 'doctor_rsi'
     order by started_at desc
     limit 1`
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    scheduleDate: row.schedule_date,
    doctorsSynced: row.doctors_synced,
    doctorsCreated: row.doctors_created,
    doctorsDeactivated: row.doctors_deactivated,
    triggeredBy: row.triggered_by,
    errorMessage: row.error_message,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
  };
}

export async function listSyncRuns(limit = 20) {
  const result = await dbQuery<{
    id: number;
    status: string;
    schedule_date: string | null;
    doctors_synced: number;
    triggered_by: string | null;
    error_message: string | null;
    started_at: Date;
    finished_at: Date | null;
  }>(
    `select id, status, schedule_date, doctors_synced, triggered_by, error_message, started_at, finished_at
     from pasienkonsul.darsi_sync_runs
     where sync_type = 'doctor_rsi'
     order by started_at desc
     limit $1`,
    [limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    scheduleDate: row.schedule_date,
    doctorsSynced: row.doctors_synced,
    triggeredBy: row.triggered_by,
    errorMessage: row.error_message,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
  }));
}
