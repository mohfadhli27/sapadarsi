/**
 * Dummy data quota RSI — format sama dengan respons API asli.
 * Aktifkan: RSI_QUOTA_MODE=mock
 * Produksi RSI hidup: RSI_QUOTA_MODE=live
 * Default auto: coba RSI dulu, fallback mock jika gagal.
 */
import type { RsiDoctorSlot, RsiUnit, RsiUnitType } from "@/src/lib/rsi-api";

export type RsiQuotaMode = "mock" | "live" | "auto";

export function getRsiQuotaMode(): RsiQuotaMode {
  const raw = (process.env.RSI_QUOTA_MODE ?? "auto").trim().toLowerCase();
  if (raw === "mock" || raw === "live" || raw === "auto") return raw;
  return "auto";
}

/** Baris mentah seperti respons POST /quota RSI */
export type RsiQuotaRawRow = {
  nama_dokter: string;
  kode_dokter: string;
  sisa_kuota: number;
  kuota: number;
  jam: string;
};

type MockDoctorSeed = {
  match: (unit: RsiUnit) => boolean;
  doctors: Array<Omit<RsiQuotaRawRow, "jam"> & { jam?: string }>;
};

/** Dokter dummy per poli — nama & gelar dari jadwal resmi RSI Surabaya */
const MOCK_BY_POLI: MockDoctorSeed[] = [
  {
    match: (u) => u.nama.includes("Penyakit Dalam") || u.rumpun.includes("PENYAKIT DALAM"),
    doctors: [
      { nama_dokter: "dr. Sheila Nalia, Sp.PD", kode_dokter: "JADWAL-sheilanaliasppd", sisa_kuota: 6, kuota: 10 },
      { nama_dokter: "dr. Agus Prabowo, Sp.PD", kode_dokter: "MOCK-PD-AGUS", sisa_kuota: 4, kuota: 10 },
      { nama_dokter: "dr. Effendi, Sp.PD", kode_dokter: "MOCK-PD-EFFENDI", sisa_kuota: 3, kuota: 8, jam: "13:30–17:00" },
    ],
  },
  {
    match: (u) => u.nama === "Spesialis Anak" || (u.rumpun.includes("ANAK") && u.subrumpun === "1"),
    doctors: [
      { nama_dokter: "dr. Bony Pramono, Sp.A", kode_dokter: "JADWAL-bonypramonospa", sisa_kuota: 5, kuota: 10 },
      { nama_dokter: "dr. Mery Susantri, Sp.A, Subsp.TKPS", kode_dokter: "MOCK-AN-MERY", sisa_kuota: 4, kuota: 10 },
      { nama_dokter: "dr. Vivin Detriana, Sp.A", kode_dokter: "MOCK-AN-VIVIN", sisa_kuota: 2, kuota: 8, jam: "10:00–12:30" },
    ],
  },
  {
    match: (u) => u.nama === "Spesialis THT" || u.rumpun.includes("THT"),
    doctors: [
      { nama_dokter: "dr. Andi Roesbiantoro, Sp.THT-KL", kode_dokter: "JADWAL-andiroesbiantorospthtkl", sisa_kuota: 7, kuota: 10 },
      { nama_dokter: "dr. Liliek Andriani, Sp.THT-KL", kode_dokter: "MOCK-THT-LILIEK", sisa_kuota: 3, kuota: 8 },
      { nama_dokter: "dr. Nurlina Siti Octaviani, Sp.THT-KL", kode_dokter: "MOCK-THT-NURLINA", sisa_kuota: 2, kuota: 6, jam: "15:00–16:00" },
    ],
  },
  {
    match: (u) => u.nama === "Spesialis Mata" || u.rumpun.includes("MATA"),
    doctors: [
      { nama_dokter: "dr. Vita Pradiptya, Sp.M", kode_dokter: "JADWAL-vitapradiptyaspm", sisa_kuota: 6, kuota: 10 },
      { nama_dokter: "dr. Kiajeng Winda Ningrum Prinasetya, Sp.M", kode_dokter: "MOCK-MT-KIAJENG", sisa_kuota: 4, kuota: 10 },
      { nama_dokter: "dr. Ita Permatasari, Sp.M", kode_dokter: "MOCK-MT-ITA", sisa_kuota: 1, kuota: 6, jam: "19:00–20:00" },
    ],
  },
  {
    match: (u) => u.nama === "Spesialis Jantung" || u.rumpun.includes("JANTUNG"),
    doctors: [
      { nama_dokter: "dr. Novia Kusumawardhani, Sp.JP", kode_dokter: "JADWAL-noviakusumawardhanispjp", sisa_kuota: 5, kuota: 10 },
      { nama_dokter: "dr. Fanty Filianovika, Sp.JP", kode_dokter: "MOCK-JT-FANTY", sisa_kuota: 3, kuota: 8 },
      { nama_dokter: "dr. Farhanah Meutia, Sp.JP", kode_dokter: "MOCK-JT-FARHANAH", sisa_kuota: 2, kuota: 6, jam: "08:00–10:00" },
    ],
  },
  {
    match: (u) => u.nama.includes("Paru") || u.rumpun.includes("PARU"),
    doctors: [
      { nama_dokter: "dr. Caesar Rozaq Auditiawan, Sp.P", kode_dokter: "MOCK-PARU-CAESAR", sisa_kuota: 4, kuota: 10 },
      { nama_dokter: "dr. Titin Sholihah Agustina, Sp.P", kode_dokter: "MOCK-PARU-TITIN", sisa_kuota: 3, kuota: 8 },
    ],
  },
  {
    match: (u) => u.nama.includes("Saraf") || u.rumpun.includes("SARAF"),
    doctors: [
      { nama_dokter: "dr. Dian Anggia Sriwijiati, Sp.N", kode_dokter: "MOCK-SARAF-DIAN", sisa_kuota: 5, kuota: 10 },
      { nama_dokter: "dr. Shobihatus Syifak, Sp.N", kode_dokter: "MOCK-SARAF-SYIFAK", sisa_kuota: 2, kuota: 8 },
    ],
  },
];

const DEFAULT_SCHEDULE = "08:00–12:00";

export function getMockRsiQuotaRaw(unit: RsiUnit): RsiQuotaRawRow[] {
  const seed = MOCK_BY_POLI.find((s) => s.match(unit));
  if (!seed) return [];

  return seed.doctors.map((d) => ({
    nama_dokter: d.nama_dokter,
    kode_dokter: d.kode_dokter,
    sisa_kuota: d.sisa_kuota,
    kuota: d.kuota,
    jam: d.jam ?? DEFAULT_SCHEDULE,
  }));
}

export function isMockQuotaResponse(doctors: RsiDoctorSlot[]): boolean {
  return doctors.some((d) => d.doctorCode.startsWith("MOCK-"));
}
