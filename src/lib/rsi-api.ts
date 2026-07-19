import { getMockRsiQuotaRaw, getRsiQuotaMode } from "@/src/lib/rsi-quota-mock";

const RSI_API_BASE =
  process.env.RSI_API_BASE_URL ?? "https://api.rsisurabaya.com:8008";

export type RsiUnitType = "reguler" | "eksekutif";

export type RsiUnit = {
  id: string;
  nama: string;
  rumpun: string;
  subrumpun: string;
  kode_urut: string;
};

export type RsiDoctorSlot = {
  doctorCode: string;
  doctorName: string;
  unitId: string;
  unitName: string;
  rumpun: string;
  unitType: RsiUnitType;
  scheduleDate: string;
  scheduleLabel?: string;
  quotaRemaining?: number;
  quotaTotal?: number;
};

type RsiApiResponse<T> = {
  metadata?: { status?: boolean; message?: string };
  response?: T;
};

async function fetchRsi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RSI_API_BASE.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json()) as RsiApiResponse<T>;
  if (!res.ok || data.metadata?.status === false) {
    throw new Error(data.metadata?.message ?? `RSI API error (${res.status})`);
  }
  return (data.response ?? data) as T;
}

export async function getRsiUnits(unitType: RsiUnitType): Promise<RsiUnit[]> {
  const path = unitType === "eksekutif" ? "/units/eksekutif" : "/units/reguler";
  const units = await fetchRsi<RsiUnit[]>(path);
  return Array.isArray(units) ? units : [];
}

function slugDoctorCode(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/^(prof\.|dr\.|drg\.)\s*/gi, "")
    .replace(/[^a-z0-9]/g, "");
  return slug ? `JADWAL-${slug}` : `JADWAL-${Date.now()}`;
}

function normalizeQuotaDoctors(
  raw: unknown,
  unit: RsiUnit,
  unitType: RsiUnitType,
  scheduleDate: string
): RsiDoctorSlot[] {
  if (!raw) return [];

  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: unknown[] }).data ?? [])
      : [];

  return list
    .map((item): RsiDoctorSlot | null => {
      const row = item as Record<string, unknown>;
      const dokterField = row.dokter;
      const nestedName =
        typeof dokterField === "object" && dokterField !== null
          ? String((dokterField as { nama?: string }).nama ?? "").trim()
          : typeof dokterField === "string"
            ? dokterField.trim()
            : "";

      const doctorName = String(
        nestedName ||
          row.nama_dokter ||
          row.nama ||
          row.DoctorName ||
          ""
      ).trim();

      const doctorCode = String(
        row.kode_dokter ?? row.id_dokter ?? row.id ?? row.DoctorId ?? ""
      ).trim() || (doctorName ? slugDoctorCode(doctorName) : "");

      if (!doctorName) return null;

      const bpjs = row.bpjs as { sisa?: number; kuota?: number } | undefined;
      const umum = row.umum as { sisa?: number; kuota?: number } | undefined;
      const asuransi = row.asuransi as { sisa?: number; kuota?: number } | undefined;

      const quotaRemaining = Number(
        bpjs?.sisa ??
          umum?.sisa ??
          asuransi?.sisa ??
          row.sisa_kuota ??
          row.kuota_sisa ??
          row.quota ??
          row.Quota ??
          row.sisa ??
          0
      );
      const quotaTotal = Number(
        row.kuota ?? bpjs?.kuota ?? umum?.kuota ?? row.total_kuota ?? row.QuotaTotal ?? 0
      );

      return {
        doctorCode,
        doctorName,
        unitId: unit.id,
        unitName: unit.nama,
        rumpun: unit.rumpun,
        unitType,
        scheduleDate,
        scheduleLabel:
          String(row.jam_praktek ?? row.jam ?? row.jadwal ?? row.schedule ?? "").trim() ||
          undefined,
        quotaRemaining: Number.isFinite(quotaRemaining) ? quotaRemaining : undefined,
        quotaTotal: Number.isFinite(quotaTotal) ? quotaTotal : undefined,
      } satisfies RsiDoctorSlot;
    })
    .filter((v): v is RsiDoctorSlot => v !== null);
}

async function postRsiQuota(unitId: string, tanggal: string) {
  const body = new URLSearchParams({
    unit_id: unitId,
    date: tanggal,
  });

  const res = await fetch(`${RSI_API_BASE.replace(/\/$/, "")}/quota`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json()) as RsiApiResponse<unknown>;
  if (!res.ok || data.metadata?.status === false) {
    throw new Error(data.metadata?.message ?? `Quota API error (${res.status})`);
  }

  return data.response;
}

export async function getRsiDoctorQuota(input: {
  unitId: string;
  tanggal: string;
  unitType?: RsiUnitType;
  unit?: RsiUnit;
}): Promise<RsiDoctorSlot[]> {
  const unitType = input.unitType ?? "reguler";
  const unit =
    input.unit ??
    ({
      id: input.unitId,
      nama: "Poli",
      rumpun: "",
      subrumpun: "1",
      kode_urut: "0",
    } satisfies RsiUnit);

  const mode = getRsiQuotaMode();

  if (mode === "mock") {
    return normalizeQuotaDoctors(
      getMockRsiQuotaRaw(unit),
      unit,
      unitType,
      input.tanggal
    );
  }

  try {
    const response = await postRsiQuota(input.unitId, input.tanggal);
    return normalizeQuotaDoctors(response, unit, unitType, input.tanggal);
  } catch (error) {
    if (mode === "live") throw error;

    const mockRows = getMockRsiQuotaRaw(unit);
    if (mockRows.length === 0) throw error;

    console.warn(
      `[RSI quota] API gagal (${error instanceof Error ? error.message : "unknown"}), pakai dummy untuk ${unit.nama}`
    );
    return normalizeQuotaDoctors(mockRows, unit, unitType, input.tanggal);
  }
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
