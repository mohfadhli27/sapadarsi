import type { RsiDoctorSlot, RsiUnit } from "@/src/lib/rsi-api";
import { todayIsoDate } from "@/src/lib/rsi-api";

const MATERNAL_RULES: Array<{ keywords: RegExp; focus: "bidan" | "perawat" | "both"; note: string }> = [
  {
    keywords: /hamil|kehamilan|janin|trimester|USG|ANC|bayi dalam kandungan/i,
    focus: "bidan",
    note: "Pemantauan kehamilan",
  },
  {
    keywords: /melahirkan|persalinan|kontraksi|ketuban|placenta/i,
    focus: "bidan",
    note: "Persalinan / kala persalinan",
  },
  {
    keywords: /menyusui|ASI|laktasi|payudara/i,
    focus: "bidan",
    note: "Laktasi & perawatan ibu",
  },
  {
    keywords: /balita|bayi|anak|tumbuh kembang|imunisasi|demam anak/i,
    focus: "both",
    note: "Kesehatan ibu dan anak",
  },
  {
    keywords: /luka|perban|infus|obat|tekanan darah|gula darah|home care|perawatan di rumah/i,
    focus: "perawat",
    note: "Perawatan keperawatan",
  },
  {
    keywords: /nifas|pasca melahirkan|kandungan|nyeri perut bawah/i,
    focus: "bidan",
    note: "Nifas / pasca persalinan",
  },
];

const BIDAN_UNIT_HINTS = /kebidanan|kandungan|ibu|anak|bayi|poli kia|kia/i;
const PERAWAT_UNIT_HINTS = /perawat|rawat jalan|home care|igd|penyakit dalam|umum/i;

export type MidwifeRecommendation = {
  practitioner: RsiDoctorSlot;
  score: number;
  reason: string;
  role: "bidan" | "perawat";
};

function isBidanCode(code: string) {
  return code.startsWith("DARSI-BIDAN") || code.startsWith("BIDAN-");
}

function isPerawatCode(code: string) {
  return code.startsWith("PERAWAT-");
}

/** Slot dari API kuota dokter RSI — bukan bidan/perawat DARSI. */
export function isClinicalDoctorSlot(slot: RsiDoctorSlot): boolean {
  const code = slot.doctorCode.toUpperCase();
  if (isBidanCode(code) || isPerawatCode(code)) return false;

  const name = slot.doctorName;
  if (/bidan|perawat|\bNs\.|\bS\.Kep\b/i.test(name)) return false;

  return /(^|\s)dr\.|\bSp\.|\bSubsp\./i.test(name);
}

export function filterMidwifePractitionerSlots(slots: RsiDoctorSlot[]): RsiDoctorSlot[] {
  return slots.filter((s) => !isClinicalDoctorSlot(s));
}

function classifyPractitioner(slot: RsiDoctorSlot): "bidan" | "perawat" {
  if (isPerawatCode(slot.doctorCode)) return "perawat";
  if (isBidanCode(slot.doctorCode)) return "bidan";
  if (BIDAN_UNIT_HINTS.test(`${slot.unitName} ${slot.rumpun ?? ""}`)) return "bidan";
  if (PERAWAT_UNIT_HINTS.test(`${slot.unitName} ${slot.rumpun ?? ""}`)) return "perawat";
  return "bidan";
}

function demoPractitioners(): RsiDoctorSlot[] {
  const today = todayIsoDate();
  return [
    {
      doctorCode: "DARSI-BIDAN-01",
      doctorName: "Bidan RSI · Ns. Siti Rahmawati, S.Kep",
      unitId: "bidan-klinik",
      unitName: "Klinik Kebidanan RSI A. Yani",
      rumpun: "Kebidanan",
      unitType: "reguler",
      scheduleDate: today,
      quotaRemaining: 8,
      quotaTotal: 10,
    },
    {
      doctorCode: "DARSI-BIDAN-02",
      doctorName: "Bidan RSI · Ns. Dewi Lestari, S.Kep",
      unitId: "bidan-kia",
      unitName: "Poli KIA",
      rumpun: "Kebidanan",
      unitType: "reguler",
      scheduleDate: today,
      quotaRemaining: 6,
      quotaTotal: 10,
    },
    {
      doctorCode: "PERAWAT-muh",
      doctorName: "Perawat RSI · Ns. Muhammad, S.Kep",
      unitId: "perawat-rj",
      unitName: "Rawat Jalan / Home Care",
      rumpun: "Perawat",
      unitType: "reguler",
      scheduleDate: today,
      quotaRemaining: 10,
      quotaTotal: 12,
    },
    {
      doctorCode: "PERAWAT-RSI-01",
      doctorName: "Perawat RSI · Ns. Ani Wulandari, S.Kep",
      unitId: "perawat-rj2",
      unitName: "Rawat Jalan / Home Care",
      rumpun: "Perawat",
      unitType: "reguler",
      scheduleDate: today,
      quotaRemaining: 8,
      quotaTotal: 12,
    },
    {
      doctorCode: "PERAWAT-RSI-02",
      doctorName: "Perawat RSI · Ns. Rina Kartika, S.Kep",
      unitId: "perawat-kia",
      unitName: "Poli KIA & Tumbuh Kembang",
      rumpun: "Perawat",
      unitType: "reguler",
      scheduleDate: today,
      quotaRemaining: 7,
      quotaTotal: 10,
    },
  ];
}

export function midwifePractitionerPool(rsiSlots: RsiDoctorSlot[]): RsiDoctorSlot[] {
  const filtered = filterMidwifePractitionerSlots(rsiSlots);
  return filtered.length > 0 ? filtered : demoPractitioners();
}

export function recommendPractitionersFromComplaint(
  complaint: string,
  rsiSlots: RsiDoctorSlot[],
  units: RsiUnit[]
): { summary: string; recommendations: MidwifeRecommendation[] } {
  const text = complaint.toLowerCase();
  const matched = MATERNAL_RULES.filter((r) => r.keywords.test(text));

  let bidanWeight = 1;
  let perawatWeight = 1;
  const reasons: string[] = [];

  for (const rule of matched) {
    reasons.push(rule.note);
    if (rule.focus === "bidan") bidanWeight += 2;
    else if (rule.focus === "perawat") perawatWeight += 2;
    else {
      bidanWeight += 1;
      perawatWeight += 1;
    }
  }

  const relevantUnits = units.filter(
    (u) => BIDAN_UNIT_HINTS.test(u.nama) || BIDAN_UNIT_HINTS.test(u.rumpun ?? "")
  );

  const pool = midwifePractitionerPool(rsiSlots);
  const scored: MidwifeRecommendation[] = [];

  for (const slot of pool) {
    if (isClinicalDoctorSlot(slot)) continue;
    const role = classifyPractitioner(slot);
    const unitMatch = relevantUnits.some((u) => u.id === slot.unitId);
    let score = role === "bidan" ? bidanWeight : perawatWeight;
    if (unitMatch) score += 2;
    if ((slot.quotaRemaining ?? 1) <= 0) continue;

    scored.push({
      practitioner: slot,
      score,
      reason: reasons[0] ?? (role === "bidan" ? "Konsultasi bidan RSI" : "Konsultasi perawat RSI"),
      role,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  const bidanPicks = scored.filter((s) => s.role === "bidan").slice(0, 4);
  const perawatPicks = scored.filter((s) => s.role === "perawat").slice(0, 4);
  const merged = [...bidanPicks, ...perawatPicks];

  const unique = new Map<string, MidwifeRecommendation>();
  for (const item of merged.length > 0 ? merged : scored.slice(0, 8)) {
    unique.set(`${item.practitioner.doctorCode}:${item.practitioner.unitId}`, item);
  }

  const recommendations = [...unique.values()].slice(0, 10);

  const summary =
    reasons.length > 0
      ? `Berdasarkan keluhan Anda, kami merekomendasikan konsultasi dengan ${recommendations.some((r) => r.role === "bidan") ? "bidan" : ""}${recommendations.some((r) => r.role === "bidan") && recommendations.some((r) => r.role === "perawat") ? " dan " : ""}${recommendations.some((r) => r.role === "perawat") ? "perawat" : ""} RSI A. Yani.`
      : "Silakan pilih bidan atau perawat RSI yang tersedia di bawah ini sesuai kebutuhan konsultasi Anda.";

  return { summary, recommendations };
}

export function recommendationsToSlots(recommendations: MidwifeRecommendation[]): RsiDoctorSlot[] {
  return recommendations.map((r) => r.practitioner);
}
