import type { ChronicDrug, EfornasDrug, InteractionFlag } from "@/src/lib/pharmacy-db-service";
import { patientFirstName, type PharmacyIntent } from "@/src/lib/pharmacy-intent";

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
  return parts
    .map((p) => map[p.toUpperCase()] ?? p)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
}

function drugStemKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^parasetamol/, "paracetamol");
}

function findChronicForDrug(chronic: ChronicDrug[], drugName: string): ChronicDrug | undefined {
  const stem = drugStemKey(drugName);
  return chronic.find(
    (c) => drugStemKey(c.nama_obat).includes(stem) || stem.includes(drugStemKey(c.nama_obat))
  );
}

export function buildDrugCardMarkdown(drug: EfornasDrug, chronic?: ChronicDrug): string {
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

function buildInteractionNarrative(
  interactions: InteractionFlag[],
  medgemmaBrief?: string
): string {
  const notable = interactions.filter((f) => f.severity !== "info");
  const mekanisme = medgemmaBrief
    ?.split("\n")
    .find((line) => /^MEKANISME:/i.test(line))
    ?.replace(/^MEKANISME:\s*/i, "")
    .trim();

  const catatan = medgemmaBrief
    ?.split("\n")
    .find((line) => /^CATATAN FARMASI:/i.test(line))
    ?.replace(/^CATATAN FARMASI:\s*/i, "")
    .trim();

  const parts: string[] = [];

  if (mekanisme) parts.push(mekanisme);

  if (notable.length > 0) {
    for (const flag of notable.slice(0, 2)) {
      parts.push(flag.detail);
    }
  }

  if (catatan) parts.push(catatan);

  if (parts.length === 0) {
    return "Kedua obat dapat digunakan bersamaan dengan pengawasan. Ikuti dosis resep dan jangan melebihi batas harian. Jika muncul efek samping, konsultasikan tenaga medis.";
  }

  return parts.join(" ");
}

function greeting(patientName?: string): string {
  const first = patientFirstName(patientName);
  return first ? `Halo ${first},` : "Halo,";
}

function closing(patientName?: string): string {
  const first = patientFirstName(patientName);
  return first
    ? `Semoga membantu, ${first}. Jika ada pertanyaan lain, saya di sini.`
    : "Semoga membantu. Jika ada pertanyaan lain, saya di sini.";
}

export function buildPharmacyStructuredResponse(input: {
  intent: PharmacyIntent;
  patientName?: string;
  efornas: EfornasDrug[];
  chronic: ChronicDrug[];
  interactions: InteractionFlag[];
  medgemmaBrief?: string;
}): string | null {
  const { intent, efornas, chronic, interactions, medgemmaBrief, patientName } = input;

  if (intent === "interaction" && efornas.length >= 2) {
    const cards = efornas.slice(0, 4).map((drug, index) => {
      const chronicMatch = findChronicForDrug(chronic, drug.nama_obat);
      return `--- Obat ${index + 1}: ${drug.nama_obat.toUpperCase()} ---\n${buildDrugCardMarkdown(drug, chronicMatch)}`;
    });

    return [
      greeting(patientName),
      "",
      "Berikut perbandingan keduanya:",
      "",
      cards.join("\n\n"),
      "",
      "---",
      "",
      "**Interaksi**",
      "",
      buildInteractionNarrative(interactions, medgemmaBrief),
      "",
      closing(patientName),
    ].join("\n");
  }

  if (intent === "drug_info" && efornas.length >= 1) {
    const drug = efornas[0];
    const chronicMatch = findChronicForDrug(chronic, drug.nama_obat);

    return [
      greeting(patientName),
      "",
      `Berikut informasi **${drug.nama_obat}**:`,
      "",
      `--- Obat: ${drug.nama_obat.toUpperCase()} ---`,
      buildDrugCardMarkdown(drug, chronicMatch),
      "",
      closing(patientName),
    ].join("\n");
  }

  if (intent === "dose_safety" && efornas.length >= 1) {
    const drug = efornas[0];
    const chronicMatch = findChronicForDrug(chronic, drug.nama_obat);
    const bentuk = [drug.sediaan, drug.kekuatan, drug.satuan].filter(Boolean).join(" ").trim();
    const batas =
      [
        drug.peresepan_maksimal?.replace(/\r/g, " ").replace(/\n/g, " ").trim(),
        drug.restriksi_obat?.trim(),
        chronicMatch?.peresepan_maksimal?.trim(),
      ]
        .filter(Boolean)
        .join(" | ") || "Sesuai resep dokter";

    const safetyLine = medgemmaBrief
      ?.split("\n")
      .find((line) => /^KEAMANAN:/i.test(line))
      ?.replace(/^KEAMANAN:\s*/i, "")
      .trim();

    const directAnswer =
      safetyLine?.toLowerCase().includes("tidak") || safetyLine?.toLowerCase().includes("hati")
        ? `**Tidak disarankan** ${safetyLine ? `— ${safetyLine}` : "melebihi dosis resep tanpa arahan dokter."}`
        : "**Ikuti dosis resep dokter** — jangan melebihi batas aman harian.";

    return [
      greeting(patientName),
      "",
      directAnswer,
      "",
      `Untuk **${drug.nama_obat}** (${bentuk || "sesuai resep"}):`,
      `• **Batas aman:** ${batas}`,
      "• **Cara pakai:** Sesuai resep, hindari dosis berlebih sekaligus.",
      "",
      "Jika ragu atau muncul efek samping, segera hubungi dokter atau IGD.",
      "",
      closing(patientName),
    ].join("\n");
  }

  return null;
}

export function shouldUseStructuredFallback(
  llmText: string,
  intent: PharmacyIntent,
  hasDrugData: boolean
): boolean {
  const trimmed = llmText.trim();
  if (!hasDrugData) return false;
  if (trimmed.length < 80) return true;
  if (intent === "interaction" && !/interaksi/i.test(trimmed) && trimmed.length < 200) {
    return true;
  }
  if (intent === "interaction" && !/fungsi:/i.test(trimmed) && !/\*\*fungsi\*\*/i.test(trimmed)) {
    return true;
  }
  return false;
}
