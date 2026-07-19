import type { RsiUnit } from "@/src/lib/rsi-api";

const SYMPTOM_RULES: Array<{ keywords: RegExp; rumpun: string[]; note: string }> = [
  {
    keywords: /telinga|teliga|tenggorokan|hidung|sinus|benda asing|nyeri telinga|infeksi telinga/i,
    rumpun: ["SPESIALIS THT", "SPESIALIS PENYAKIT DALAM"],
    note: "Keluhan THT",
  },
  {
    keywords: /batuk|pilek|flu|sesak|napas|paru|bronk|asma/i,
    rumpun: ["SPESIALIS PARU", "SPESIALIS PENYAKIT DALAM", "SPESIALIS THT"],
    note: "Keluhan pernapasan",
  },
  {
    keywords: /demam|panas|badan lemas|menggigil/i,
    rumpun: ["SPESIALIS PENYAKIT DALAM", "SPESIALIS ANAK"],
    note: "Keluhan demam",
  },
  {
    keywords: /sakit kepala|pusing|vertigo|migrain/i,
    rumpun: ["SPESIALIS SARAF", "SPESIALIS PENYAKIT DALAM"],
    note: "Keluhan neurologis ringan",
  },
  {
    keywords: /nyeri dada|jantung|berdebar/i,
    rumpun: ["SPESIALIS JANTUNG", "SPESIALIS PENYAKIT DALAM"],
    note: "Keluhan kardiovaskular",
  },
  {
    keywords: /perut|mual|muntah|diare|maag|asam lambung/i,
    rumpun: ["SPESIALIS PENYAKIT DALAM", "SPESIALIS BEDAH DIGESTIF"],
    note: "Keluhan pencernaan",
  },
  {
    keywords: /kulit|gatal|ruam|jerawat|alergi/i,
    rumpun: ["SPESIALIS KULIT DAN KELAMIN", "SPESIALIS PENYAKIT DALAM"],
    note: "Keluhan kulit",
  },
  {
    keywords: /hamil|kehamilan|janin|bayi|anak|balita/i,
    rumpun: ["SPESIALIS KEBIDANAN DAN KANDUNGAN", "SPESIALIS ANAK"],
    note: "Kesehatan ibu/anak",
  },
];

export type UnitRecommendation = {
  unit: RsiUnit;
  score: number;
  reason: string;
};

export function recommendUnitsFromComplaint(
  complaint: string,
  units: RsiUnit[]
): { summary: string; recommendations: UnitRecommendation[] } {
  const text = complaint.toLowerCase();
  const matchedRules = SYMPTOM_RULES.filter((rule) => rule.keywords.test(text));

  const rumpunScores = new Map<string, { score: number; reason: string }>();
  for (const rule of matchedRules) {
    for (const rumpun of rule.rumpun) {
      const key = rumpun.toUpperCase();
      const prev = rumpunScores.get(key);
      rumpunScores.set(key, {
        score: (prev?.score ?? 0) + 1,
        reason: rule.note,
      });
    }
  }

  if (rumpunScores.size === 0) {
    rumpunScores.set("SPESIALIS PENYAKIT DALAM", {
      score: 1,
      reason: "Keluhan umum — poli penyakit dalam",
    });
  }

  const recommendations: UnitRecommendation[] = [];

  for (const unit of units) {
    const rumpunKey = unit.rumpun.toUpperCase();
    const match = rumpunScores.get(rumpunKey);
    if (!match) continue;

    let score = match.score;
    if (unit.subrumpun === "1") score += 0.5;
    if (unit.nama.toLowerCase().includes("penyakit dalam") && /batuk|demam/i.test(text)) {
      score += 0.3;
    }

    recommendations.push({ unit, score, reason: match.reason });
  }

  recommendations.sort((a, b) => b.score - a.score);

  const top = recommendations.slice(0, 5);
  const uniqueByRumpun = new Map<string, UnitRecommendation>();
  for (const item of top) {
    const key = item.unit.rumpun;
    if (!uniqueByRumpun.has(key)) uniqueByRumpun.set(key, item);
  }

  const finalList = [...uniqueByRumpun.values()].slice(0, 3);
  const summary =
    finalList.length > 0
      ? `Berdasarkan keluhan Anda, kami merekomendasikan konsultasi ke ${finalList
          .map((r) => r.unit.nama)
          .join(", ")}.`
      : "Silakan pilih poli yang sesuai dengan keluhan Anda.";

  return { summary, recommendations: finalList };
}
