import { dbQuery } from "@/src/lib/db";
import {
  getRsiDoctorQuota,
  getRsiUnits,
  todayIsoDate,
  type RsiDoctorSlot,
  type RsiUnit,
  type RsiUnitType,
} from "@/src/lib/rsi-api";
import { getRsiQuotaMode, isMockQuotaResponse } from "@/src/lib/rsi-quota-mock";

type DirectoryRow = {
  doctor_code: string;
  doctor_name: string;
  unit_id: string | null;
  unit_name: string;
  rumpun: string | null;
  unit_type: string;
  schedule_label: string | null;
  quota_remaining: number | null;
  quota_total: number | null;
};

function rowToSlot(row: DirectoryRow, scheduleDate: string): RsiDoctorSlot {
  return {
    doctorCode: row.doctor_code,
    doctorName: row.doctor_name,
    unitId: row.unit_id ?? "",
    unitName: row.unit_name,
    rumpun: row.rumpun ?? "",
    unitType: (row.unit_type as RsiUnitType) ?? "reguler",
    scheduleDate,
    scheduleLabel: row.schedule_label ?? undefined,
    quotaRemaining: row.quota_remaining ?? undefined,
    quotaTotal: row.quota_total ?? undefined,
  };
}

export async function getDirectoryDoctorsForUnit(
  unitId: string,
  unitType: RsiUnitType = "reguler",
  unitName?: string
): Promise<RsiDoctorSlot[]> {
  const scheduleDate = todayIsoDate();
  const result = await dbQuery<DirectoryRow>(
    `select doctor_code, doctor_name, unit_id, unit_name, rumpun, unit_type,
            schedule_label, quota_remaining, quota_total
     from pasienkonsul.darsi_doctor_directory
     where is_active = true
       and unit_type = $2
       and (unit_id = $1 or unit_id is null or ($3::text is not null and unit_name = $3))
     order by doctor_name`,
    [unitId, unitType, unitName ?? null]
  );
  return result.rows.map((r) => rowToSlot(r, scheduleDate));
}

export async function getAvailableDoctorsForUnit(input: {
  unitId: string;
  unit?: RsiUnit;
  unitType?: RsiUnitType;
  tanggal?: string;
}): Promise<{ doctors: RsiDoctorSlot[]; source: "rsi" | "directory" | "mock" }> {
  const unitType = input.unitType ?? "reguler";
  const tanggal = input.tanggal ?? todayIsoDate();

  try {
    const quota = await getRsiDoctorQuota({
      unitId: input.unitId,
      tanggal,
      unitType,
      unit: input.unit,
    });
    const available = quota.filter((d) => (d.quotaRemaining ?? 1) > 0);
    if (available.length > 0) {
      const source =
        getRsiQuotaMode() === "mock" || isMockQuotaResponse(available) ? "mock" : "rsi";
      if (source === "rsi") {
        await upsertDirectoryFromSlots(available);
      }
      return { doctors: available, source };
    }
  } catch {
    /* fallback ke direktori lokal */
  }

  const directory = await getDirectoryDoctorsForUnit(
    input.unitId,
    unitType,
    input.unit?.nama
  );
  return { doctors: directory.filter((d) => (d.quotaRemaining ?? 1) > 0), source: "directory" };
}

async function upsertDirectoryFromSlots(slots: RsiDoctorSlot[]) {
  for (const slot of slots) {
    await dbQuery(
      `insert into pasienkonsul.darsi_doctor_directory
         (doctor_code, doctor_name, unit_id, unit_name, rumpun, unit_type,
          schedule_label, quota_remaining, quota_total, synced_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9, current_timestamp, current_timestamp)
       on conflict (doctor_code) do update set
         doctor_name = excluded.doctor_name,
         unit_id = excluded.unit_id,
         unit_name = excluded.unit_name,
         rumpun = excluded.rumpun,
         quota_remaining = excluded.quota_remaining,
         quota_total = excluded.quota_total,
         synced_at = current_timestamp,
         updated_at = current_timestamp`,
      [
        slot.doctorCode,
        slot.doctorName,
        slot.unitId,
        slot.unitName,
        slot.rumpun,
        slot.unitType,
        slot.scheduleLabel ?? null,
        slot.quotaRemaining ?? null,
        slot.quotaTotal ?? null,
      ]
    );

    // Samakan kode staff jika nama dokter cocok (RSI kode_dokter baru menggantikan JADWAL-*)
    await dbQuery(
      `update pasienkonsul.darsi_staff_accounts s
       set doctor_code = $1, display_name = $2, unit_name = $3, updated_at = current_timestamp
       where s.is_active = true
         and lower(regexp_replace(regexp_replace(s.display_name, '^(prof\\.|dr\\.)\\s*', '', 'i'), '[^a-z0-9]', '', 'g'))
           = lower(regexp_replace(regexp_replace($2::text, '^(prof\\.|dr\\.)\\s*', '', 'i'), '[^a-z0-9]', '', 'g'))
         and s.doctor_code is distinct from $1`,
      [slot.doctorCode, slot.doctorName, slot.unitName]
    );
  }
}

/** Dokter DARSI aktif (bukan bidan/perawat). */
export async function getDarsiPractitioners(): Promise<RsiDoctorSlot[]> {
  const scheduleDate = todayIsoDate();
  const result = await dbQuery<DirectoryRow>(
    `select d.doctor_code, d.doctor_name, d.unit_id, d.unit_name, d.rumpun, d.unit_type,
            d.schedule_label, d.quota_remaining, d.quota_total
     from pasienkonsul.darsi_doctor_directory d
     join pasienkonsul.darsi_staff_accounts s on s.doctor_code = d.doctor_code and s.is_active = true
     where d.is_active = true
       and d.doctor_code like 'DARSI-%'
       and d.doctor_code not like 'DARSI-BIDAN%'
       and s.role = 'doctor'
     order by d.doctor_name`,
    []
  );
  return result.rows.map((r) => rowToSlot(r, scheduleDate));
}

/** Bidan/perawat DARSI aktif — tampilkan semua untuk dipilih pasien. */
export async function getDarsiNurses(): Promise<RsiDoctorSlot[]> {
  const scheduleDate = todayIsoDate();
  const result = await dbQuery<{
    doctor_code: string;
    display_name: string;
    unit_name: string | null;
  }>(
    `select doctor_code, display_name, unit_name
     from pasienkonsul.darsi_staff_accounts
     where is_active = true
       and role = 'nurse'
       and doctor_code is not null
     order by display_name`,
    []
  );

  return result.rows.map((r) => ({
    doctorCode: r.doctor_code,
    doctorName: r.display_name,
    unitId: "BIDAN-DARSI",
    unitName: r.unit_name ?? "Konsultasi Bidan",
    rumpun: "BIDAN",
    unitType: "reguler" as RsiUnitType,
    scheduleDate,
    scheduleLabel: "Online",
    quotaRemaining: 99,
    quotaTotal: 99,
  }));
}

export async function findStaffIdByDoctorCode(doctorCode: string): Promise<number | null> {
  const result = await dbQuery<{ id: number }>(
    `select id from pasienkonsul.darsi_staff_accounts
     where doctor_code = $1 and is_active = true limit 1`,
    [doctorCode]
  );
  return result.rows[0]?.id ?? null;
}

export async function filterDoctorsWithStaffAccount(
  doctors: RsiDoctorSlot[]
): Promise<RsiDoctorSlot[]> {
  if (doctors.length === 0) return [];
  const codes = doctors.map((d) => d.doctorCode);
  const result = await dbQuery<{ doctor_code: string }>(
    `select doctor_code from pasienkonsul.darsi_staff_accounts
     where is_active = true and doctor_code = any($1::text[])`,
    [codes]
  );
  const registered = new Set(result.rows.map((r) => r.doctor_code));
  return doctors.filter((d) => registered.has(d.doctorCode));
}

type UnitRecommendationRef = {
  unitId: string;
  unitName: string;
  rumpun: string;
  score?: number;
};

/** Kumpulkan dokter dari beberapa poli teratas sesuai triage — kartu bisa banyak seperti Halodoc. */
export async function collectStaffDoctorsForRecommendations(
  recommendations: UnitRecommendationRef[],
  unitType: RsiUnitType = "reguler",
  scheduleDate?: string
): Promise<{ doctors: RsiDoctorSlot[]; matchedUnit: UnitRecommendationRef | null }> {
  const tanggal = scheduleDate ?? todayIsoDate();
  const units = await getRsiUnits(unitType);
  const sorted = [...recommendations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const matchedUnit = sorted[0] ?? null;
  const merged = new Map<string, RsiDoctorSlot>();

  for (const rec of sorted.slice(0, 4)) {
    const unit =
      units.find((u) => u.id === rec.unitId) ??
      units.find((u) => u.nama === rec.unitName) ??
      units.find((u) => u.rumpun.toUpperCase() === rec.rumpun.toUpperCase());
    if (!unit) continue;

    const { doctors: available } = await getAvailableDoctorsForUnit({
      unitId: unit.id,
      unit,
      unitType,
      tanggal,
    });
    const withStaff = await filterDoctorsWithStaffAccount(available);
    for (const doc of withStaff) {
      merged.set(`${doc.doctorCode}:${doc.unitId}`, doc);
    }
  }

  const darsiDoctors = await getDarsiPractitioners();
  const seen = new Set<string>();
  const doctorList: RsiDoctorSlot[] = [];

  for (const d of [...darsiDoctors, ...merged.values()]) {
    const key = `${d.doctorCode}:${d.unitId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    doctorList.push(d);
  }

  return { doctors: doctorList.slice(0, 12), matchedUnit };
}

export async function syncDoctorDirectoryFromRsi() {
  const units = await getRsiUnits("reguler");
  const tanggal = todayIsoDate();
  let synced = 0;

  for (const unit of units.slice(0, 30)) {
    try {
      const { doctors } = await getAvailableDoctorsForUnit({
        unitId: unit.id,
        unit,
        unitType: "reguler",
        tanggal,
      });
      synced += doctors.length;
    } catch {
      /* skip unit */
    }
  }
  return synced;
}
