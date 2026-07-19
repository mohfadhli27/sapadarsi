import { dbQuery } from "@/src/lib/db";
import {
  buildIntentGuidance,
  buildSearchQuery,
  detectPharmacyIntent,
  inferFocusDrugs,
  patientFirstName,
  type PharmacyIntent,
} from "@/src/lib/pharmacy-intent";

export type EfornasDrug = {
  nama_obat: string;
  nama_obat_internasional: string | null;
  kelas_terapi: string | null;
  sub_kelas_terapi: string | null;
  komposisi: string | null;
  kekuatan: string | null;
  sediaan: string | null;
  satuan: string | null;
  restriksi_obat: string | null;
  restriksi_sediaan: string | null;
  peresepan_maksimal: string | null;
};

export type ChronicDrug = {
  nama_obat: string;
  restriksi: string | null;
  peresepan_maksimal: string | null;
  smf: string | null;
};

export type MasterDrug = {
  nama_obat: string;
  kategori: string;
};

export type InteractionFlag = {
  type: "duplicate_ingredient" | "same_therapeutic_class" | "restriction" | "chronic_rule";
  severity: "info" | "warning" | "high";
  drugs: string[];
  detail: string;
};

const STOPWORDS = new Set([
  "saya", "aku", "yang", "untuk", "dengan", "dari", "pada", "ini", "itu", "dan",
  "atau", "apa", "bisa", "boleh", "obat", "minum", "diminum", "kasih", "dikasih",
  "dokter", "resep", "berapa", "kali", "hari", "jam", "sudah", "belum", "juga",
  "ada", "tidak", "gak", "ga", "nya", "deh", "dong", "kah", "the", "and",
]);

const DUPLICATE_CLASS_GROUPS: Array<{
  label: string;
  patterns: RegExp[];
  exclude?: RegExp;
}> = [
  {
    label: "NSAID / pereda nyeri antiinflamasi",
    patterns: [/ibuprofen/i, /mefenamat/i, /diklofenak/i, /meloxicam/i, /ketoprofen/i, /asam mefenamat/i],
    exclude: /paracetamol|parasetamol|acetaminophen/i,
  },
  {
    label: "Antibiotik",
    patterns: [/antibiotik/i, /antiinfeksi/i, /amoxicillin/i, /azithromycin/i, /ciprofloxacin/i],
  },
  {
    label: "Antikoagulan / pengencer darah",
    patterns: [/antikoagulan/i, /warfarin/i, /heparin/i, /pengencer darah/i],
  },
  {
    label: "Antihipertensi",
    patterns: [/antihipertensi/i, /kardiovaskular/i, /amlodipine/i, /captopril/i],
  },
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function drugStemKey(name: string): string {
  return normalizeText(name)
    .replace(/[^a-z0-9]/g, "")
    .replace(/^parasetamol/, "paracetamol")
    .replace(/^acetaminophen/, "paracetamol");
}

function pickBestEfornasVariant(rows: EfornasDrug[]): EfornasDrug {
  const scored = rows.map((row) => {
    let score = 0;
    const sediaan = (row.sediaan ?? "").toUpperCase();
    const kekuatan = row.kekuatan ?? "";

    if (sediaan.includes("TABLET")) score += 20;
    if (sediaan.includes("KAPSUL")) score += 15;
    if (sediaan.includes("SIRUP") || sediaan.includes("SUSPENSI")) score += 8;
    if (sediaan.includes("INJEKSI") || sediaan.includes("INFUS")) score -= 5;

    const stem = drugStemKey(row.nama_obat);
    if (stem.includes("paracetamol") && kekuatan === "500") score += 10;
    if (stem.includes("ibuprofen") && (kekuatan === "200" || kekuatan === "400")) score += 8;

    if (row.peresepan_maksimal?.trim()) score += 5;
    if (row.restriksi_obat?.trim()) score += 2;

    return { row, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.row ?? rows[0];
}

function dedupeEfornasByDrug(drugs: EfornasDrug[]): EfornasDrug[] {
  const groups = new Map<string, EfornasDrug[]>();
  for (const drug of drugs) {
    const key = drugStemKey(drug.nama_obat);
    const list = groups.get(key) ?? [];
    list.push(drug);
    groups.set(key, list);
  }
  return [...groups.values()].map(pickBestEfornasVariant);
}

function formatKelasTerapi(kelas: string | null): string {
  if (!kelas) return "Informasi kelas terapi tidak tersedia di formularium";
  const parts = kelas
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const map: Record<string, string> = {
    ANALGESIK: "Pereda nyeri",
    ANTIPIRETIK: "Penurun demam",
    "ANTIINFLAMASI NON STEROID": "Antiinflamasi (NSAID)",
    ANTIPIRAI: "Penurun demam",
  };
  const readable = parts
    .map((p) => map[p.toUpperCase()] ?? p)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return readable.join(", ");
}

function formatDrugCard(drug: EfornasDrug, chronic?: ChronicDrug): string {
  const bentuk = [drug.sediaan, drug.kekuatan, drug.satuan]
    .filter(Boolean)
    .join(" ")
    .trim();

  const batasParts = [
    drug.peresepan_maksimal?.replace(/\r/g, " ").replace(/\n/g, " ").trim(),
    drug.restriksi_obat?.trim(),
    chronic?.peresepan_maksimal?.trim(),
    chronic?.restriksi?.trim(),
  ].filter(Boolean);

  const caraPakai =
    bentuk.toUpperCase().includes("TABLET") || bentuk.toUpperCase().includes("KAPSUL")
      ? "Sesudah makan, sesuai resep dokter"
      : bentuk.toUpperCase().includes("SIRUP") || bentuk.toUpperCase().includes("SUSPENSI")
        ? "Sesuai dosis resep, kocok sebelum minum"
        : "Sesuai petunjuk resep dokter";

  return [
    `• **Fungsi:** ${formatKelasTerapi(drug.kelas_terapi)}`,
    `• **Bentuk & kekuatan:** ${bentuk || "Sesuai resep dokter"}`,
    `• **Cara pakai:** ${caraPakai}`,
    `• **Batas aman:** ${batasParts.join(" | ") || "Sesuai resep dokter"}`,
  ].join("\n");
}

function findChronicForDrug(chronic: ChronicDrug[], drugName: string): ChronicDrug | undefined {
  const stem = drugStemKey(drugName);
  return chronic.find((c) => drugStemKey(c.nama_obat).includes(stem) || stem.includes(drugStemKey(c.nama_obat)));
}

function tokenizeQuery(message: string): string[] {
  const tokens = normalizeText(message)
    .replace(/[^a-z0-9\s%+-]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

  const unique = [...new Set(tokens)];
  const phrases: string[] = [];

  for (let i = 0; i < unique.length - 1; i++) {
    phrases.push(`${unique[i]} ${unique[i + 1]}`);
  }

  return [...unique, ...phrases].slice(0, 12);
}

function parseIngredients(komposisi: string | null): string[] {
  if (!komposisi) return [];
  return komposisi
    .split(/[\r\n+,;/]+/)
    .map((part) =>
      part
        .replace(/\d+(\.\d+)?\s*(mg|g|ml|%|mcg|iu|unit)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    )
    .filter((part) => part.length >= 3);
}

export async function searchEfornas(terms: string[]): Promise<EfornasDrug[]> {
  if (terms.length === 0) return [];

  const patterns = terms.map((t) => `%${t}%`);
  const result = await dbQuery<EfornasDrug>(
    `SELECT DISTINCT ON (lower(nama_obat))
       nama_obat,
       nama_obat_internasional,
       kelas_terapi,
       sub_kelas_terapi,
       komposisi,
       kekuatan,
       sediaan,
       satuan,
       restriksi_obat,
       restriksi_sediaan,
       peresepan_maksimal
     FROM obat_efornas
     WHERE ${terms
       .map(
         (_, i) =>
           `(nama_obat ILIKE $${i + 1}
             OR nama_obat_internasional ILIKE $${i + 1}
             OR komposisi ILIKE $${i + 1}
             OR EXISTS (
               SELECT 1 FROM unnest(COALESCE(alternative_names, '{}'::text[])) alt
               WHERE alt ILIKE $${i + 1}
             ))`
       )
       .join(" OR ")}
     ORDER BY lower(nama_obat)
     LIMIT 15`,
    patterns
  );

  return result.rows;
}

export async function searchChronicDrugs(terms: string[]): Promise<ChronicDrug[]> {
  if (terms.length === 0) return [];

  const patterns = terms.map((t) => `%${t}%`);
  const result = await dbQuery<ChronicDrug>(
    `SELECT nama_obat, restriksi, peresepan_maksimal, smf
     FROM obat_kronis
     WHERE ${terms.map((_, i) => `nama_obat ILIKE $${i + 1}`).join(" OR ")}
     ORDER BY nama_obat
     LIMIT 10`,
    patterns
  );

  return result.rows;
}

export async function searchMasterDrugs(terms: string[]): Promise<MasterDrug[]> {
  if (terms.length === 0) return [];

  const patterns = terms.map((t) => `%${t}%`);
  const result = await dbQuery<MasterDrug>(
    `SELECT nama_obat, kategori
     FROM master_obat
     WHERE ${terms.map((_, i) => `nama_obat ILIKE $${i + 1}`).join(" OR ")}
     ORDER BY nama_obat
     LIMIT 10`,
    patterns
  );

  return result.rows;
}

function drugMentionedInMessage(message: string, drugName: string): boolean {
  const msg = normalizeText(message);
  const name = normalizeText(drugName);
  if (msg.includes(name)) return true;

  const tokens = name
    .replace(/[^a-z0-9\s%+-]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  return tokens.some((token) => msg.includes(token));
}

function filterRelevantDrugs(message: string, efornas: EfornasDrug[]): EfornasDrug[] {
  const mentioned = efornas.filter((d) => drugMentionedInMessage(message, d.nama_obat));
  return mentioned.length > 0 ? mentioned.slice(0, 6) : efornas.slice(0, 4);
}

function filterRelevantChronic(message: string, chronic: ChronicDrug[]): ChronicDrug[] {
  const mentioned = chronic.filter((d) => drugMentionedInMessage(message, d.nama_obat));
  return mentioned.length > 0 ? mentioned : chronic.slice(0, 3);
}

export async function searchDrugsInMessage(message: string) {
  const terms = tokenizeQuery(message);
  const fullMessage = normalizeText(message);

  const [efornas, chronic, master] = await Promise.all([
    searchEfornas(terms),
    searchChronicDrugs(terms),
    searchMasterDrugs(terms),
  ]);

  const directNameMatches = await dbQuery<EfornasDrug>(
    `SELECT DISTINCT ON (lower(nama_obat))
       nama_obat,
       nama_obat_internasional,
       kelas_terapi,
       sub_kelas_terapi,
       komposisi,
       kekuatan,
       sediaan,
       satuan,
       restriksi_obat,
       restriksi_sediaan,
       peresepan_maksimal
     FROM obat_efornas
     WHERE $1 ILIKE '%' || lower(nama_obat) || '%'
        OR ($2 <> '' AND lower(nama_obat) ILIKE '%' || $2 || '%')
     ORDER BY lower(nama_obat)
     LIMIT 10`,
    [fullMessage, terms[0] ?? ""]
  );

  const mergedEfornas = new Map<string, EfornasDrug>();
  for (const row of [...efornas, ...directNameMatches.rows]) {
    mergedEfornas.set(normalizeText(row.nama_obat), row);
  }

  const allEfornas = [...mergedEfornas.values()];
  const relevantEfornas = dedupeEfornasByDrug(filterRelevantDrugs(message, allEfornas));
  const relevantChronic = filterRelevantChronic(message, chronic);

  return {
    terms,
    efornas: relevantEfornas,
    chronic: relevantChronic,
    master: master.slice(0, 4),
  };
}

export function checkMedicationInteractions(input: {
  efornas: EfornasDrug[];
  chronic: ChronicDrug[];
}): InteractionFlag[] {
  const flags: InteractionFlag[] = [];
  const drugs = input.efornas;

  const ingredientMap = new Map<string, string[]>();
  for (const drug of drugs) {
    for (const ingredient of parseIngredients(drug.komposisi)) {
      const list = ingredientMap.get(ingredient) ?? [];
      list.push(drug.nama_obat);
      ingredientMap.set(ingredient, list);
    }
  }

  for (const [ingredient, drugNames] of ingredientMap) {
    const uniqueDrugs = [...new Set(drugNames)];
    if (uniqueDrugs.length > 1) {
      flags.push({
        type: "duplicate_ingredient",
        severity: "warning",
        drugs: uniqueDrugs,
        detail: `Bahan aktif sama terdeteksi: "${ingredient}" pada ${uniqueDrugs.join(", ")}. Risiko overdosis atau efek ganda.`,
      });
    }
  }

  for (const group of DUPLICATE_CLASS_GROUPS) {
    const matched = drugs.filter((drug) => {
      if (group.exclude?.test(drug.nama_obat)) return false;
      const blob = [drug.nama_obat, drug.nama_obat_internasional, drug.komposisi]
        .filter(Boolean)
        .join(" ");
      return group.patterns.some((pattern) => pattern.test(blob));
    });

    if (matched.length > 1) {
      flags.push({
        type: "same_therapeutic_class",
        severity: "warning",
        drugs: matched.map((d) => d.nama_obat),
        detail: `Beberapa obat dalam kelompok ${group.label}. Perlu waspada efek ganda atau interaksi kelas yang sama.`,
      });
    }
  }

  for (const drug of drugs) {
    if (drug.restriksi_obat?.trim()) {
      flags.push({
        type: "restriction",
        severity: "info",
        drugs: [drug.nama_obat],
        detail: `Restriksi ${drug.nama_obat}: ${drug.restriksi_obat.trim()}`,
      });
    }
    if (drug.peresepan_maksimal?.trim()) {
      flags.push({
        type: "restriction",
        severity: "info",
        drugs: [drug.nama_obat],
        detail: `Batas peresepan ${drug.nama_obat}: ${drug.peresepan_maksimal.trim()}`,
      });
    }
  }

  for (const drug of input.chronic) {
    const parts = [
      drug.restriksi?.trim(),
      drug.peresepan_maksimal?.trim() ? `Maksimal: ${drug.peresepan_maksimal.trim()}` : "",
      drug.smf?.trim() ? `SMF: ${drug.smf.trim()}` : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      flags.push({
        type: "chronic_rule",
        severity: "warning",
        drugs: [drug.nama_obat],
        detail: `Aturan obat kronis ${drug.nama_obat}: ${parts.join(" | ")}`,
      });
    }
  }

  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = `${flag.type}:${flag.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildPharmacyDbContext(input: {
  message: string;
  intent: PharmacyIntent;
  efornas: EfornasDrug[];
  chronic: ChronicDrug[];
  master: MasterDrug[];
  interactions: InteractionFlag[];
}): string {
  const lines: string[] = [
    "[INTERNAL — jangan tampilkan ke pasien]",
  ];

  if (input.intent === "interaction") {
    lines.push(
      "Mode interaksi: kartu obat apple-to-apple (4 poin identik per obat) + section Interaksi."
    );
  } else {
    lines.push("Jangan paksa template panjang. Jawab sesuai mode panduan gaya.");
  }

  if (input.efornas.length === 0 && input.chronic.length === 0 && input.master.length === 0) {
    lines.push("- Tidak ada data obat spesifik di formularium untuk pertanyaan ini.");
    return lines.join("\n");
  }

  if (input.efornas.length > 0) {
    lines.push("", `Kartu obat (${input.efornas.length} obat — format identik):`);
    input.efornas.forEach((drug, index) => {
      const chronic = findChronicForDrug(input.chronic, drug.nama_obat);
      lines.push("", `--- Obat ${index + 1}: ${drug.nama_obat} ---`);
      lines.push(formatDrugCard(drug, chronic));
      if (drug.komposisi?.trim()) {
        lines.push(`• Komposisi: ${drug.komposisi.replace(/\r/g, " ").replace(/\n/g, " ")}`);
      }
    });
  } else if (input.chronic.length > 0) {
    lines.push("", "Data obat kronis:");
    for (const drug of input.chronic.slice(0, 4)) {
      lines.push(
        `--- ${drug.nama_obat} ---`,
        `• Fungsi: Obat kronis`,
        `• Bentuk & kekuatan: Sesuai resep dokter`,
        `• Cara pakai: Sesuai resep dokter`,
        `• Batas aman: ${[drug.peresepan_maksimal, drug.restriksi].filter(Boolean).join(" | ") || "Sesuai resep dokter"}`
      );
    }
  }

  const notableInteractions =
    input.intent === "interaction"
      ? input.interactions.filter((f) => f.severity !== "info")
      : [];
  if (notableInteractions.length > 0) {
    lines.push("", "Catatan interaksi (susun natural, tanpa label teknis):");
    for (const flag of notableInteractions.slice(0, 4)) {
      lines.push(`- ${flag.detail}`);
    }
  }

  return lines.join("\n");
}

function filterToFocusDrugs(drugs: EfornasDrug[], focusDrugs: string[]): EfornasDrug[] {
  if (focusDrugs.length === 0) return drugs;
  const stems = focusDrugs.map((d) => drugStemKey(d));
  return drugs.filter((drug) => {
    const stem = drugStemKey(drug.nama_obat);
    return stems.some((s) => stem.includes(s) || s.includes(stem));
  });
}

type HistoryRow = { sender_type: string; message_text: string };

export async function enrichPharmacyMessage(
  message: string,
  history: HistoryRow[] = [],
  patientName?: string
) {
  const intent = detectPharmacyIntent(message, history);
  const focusDrugs = inferFocusDrugs(message, history);
  const searchQuery = buildSearchQuery(message, focusDrugs);
  const isFollowUp = history.length > 0 && intent === "follow_up";

  const search = await searchDrugsInMessage(searchQuery);
  let efornas = filterToFocusDrugs(
    dedupeEfornasByDrug(search.efornas),
    focusDrugs
  );
  if (efornas.length === 0) {
    efornas = dedupeEfornasByDrug(search.efornas);
  }
  efornas = efornas.slice(0, intent === "interaction" ? 4 : 2);

  const chronic = filterRelevantChronic(searchQuery, search.chronic).filter((c) =>
    focusDrugs.length === 0
      ? true
      : focusDrugs.some((f) => drugStemKey(c.nama_obat).includes(drugStemKey(f)))
  );

  const interactions =
    intent === "interaction"
      ? checkMedicationInteractions({ efornas, chronic })
      : [];

  const intentGuidance = buildIntentGuidance({
    intent,
    focusDrugs,
    patientFirstName: patientFirstName(patientName),
    isFollowUp,
  });

  const context = [
    intentGuidance,
    buildPharmacyDbContext({
      message,
      intent,
      efornas,
      chronic,
      master: search.master,
      interactions,
    }),
  ].join("\n\n");

  return {
    context,
    intent,
    focusDrugs,
    efornas,
    chronic,
    interactions,
    hasDrugData: efornas.length > 0 || chronic.length > 0,
    hasInteractions: interactions.some((f) => f.severity !== "info"),
    interactionCount: interactions.length,
  };
}
