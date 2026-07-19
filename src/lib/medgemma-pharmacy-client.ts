/**
 * MedGemma — modul analisis farmasi internal untuk orchestrator apoteker Nemotron.
 */

const DEFAULT_MODEL = "medgemma:4b";
const DEFAULT_ENDPOINT = "http://10.9.23.200:11434/api/chat";

function medGemmaConfig() {
  return {
    model: process.env.MEDGEMMA_OLLAMA_MODEL?.trim() || DEFAULT_MODEL,
    endpoint:
      process.env.MEDGEMMA_OLLAMA_CHAT_URL?.trim() ||
      `${(process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/chat`,
    temperature: Number(process.env.MEDGEMMA_PHARMACY_TEMPERATURE || "0.12"),
    maxTokens: Number(process.env.MEDGEMMA_PHARMACY_MAX_TOKENS || "640"),
    timeoutMs: Number(process.env.MEDGEMMA_PHARMACY_TIMEOUT_MS || "90000"),
  };
}

function buildPharmacySystemPrompt() {
  return [
    "Anda modul analisis farmasi DARSI (MedGemma) — INTERNAL untuk apoteker digital.",
    "Tugas: analisis interaksi obat, keamanan dosis, kontraindikasi, dan mekanisme farmakologi ringkas.",
    "Gunakan data konteks obat yang diberikan. Jangan mengarang obat di luar konteks.",
    "DILARANG menyebut chatbot, AI, Nemotron, MedGemma, database, atau e-Fornas ke pasien.",
    "Jangan meresepkan obat baru atau diagnosis.",
    "",
    "Format output (teks, bukan JSON):",
    "RINGKASAN: 1-2 kalimat inti pertanyaan pasien",
    "MEKANISME: penjelasan singkat cara kerja / interaksi (jika relevan)",
    "KEAMANAN: aman|hati-hati|tidak_disarankan + alasan singkat",
    "CATATAN FARMASI: poin klinis penting (maks 3 bullet mental)",
    "ESKALASI DOKTER: ya/tidak + alasan singkat jika gejala berat/overdosis",
  ].join("\n");
}

export type MedGemmaPharmacyBrief = {
  answer: string;
  model: string;
  safetyLevel: "safe" | "caution" | "avoid";
  shouldEscalate: boolean;
};

function parseSafetyFromBrief(text: string): {
  safetyLevel: "safe" | "caution" | "avoid";
  shouldEscalate: boolean;
} {
  const lower = text.toLowerCase();
  let safetyLevel: "safe" | "caution" | "avoid" = "safe";

  if (/keamanan:\s*tidak|tidak_disarankan|tidak disarankan/i.test(text)) {
    safetyLevel = "avoid";
  } else if (/keamanan:\s*hati/i.test(text)) {
    safetyLevel = "caution";
  }

  const shouldEscalate =
    safetyLevel === "avoid" ||
    /eskalasi dokter:\s*ya|overdosis|sesak|pingsan|ruam berat|perdarahan/i.test(lower);

  return { safetyLevel, shouldEscalate };
}

export function buildPharmacyMedGemmaQuery(input: {
  message: string;
  intent: string;
  focusDrugs: string[];
  dbContext: string;
}): string {
  const lines = [
    `Pertanyaan pasien: ${input.message}`,
    `Intent: ${input.intent}`,
    input.focusDrugs.length > 0 ? `Obat fokus: ${input.focusDrugs.join(", ")}` : "",
    "",
    "Konteks obat dari formularium RSI:",
    input.dbContext.replace(/\[INTERNAL[^\]]*\]/gi, "").trim(),
  ].filter(Boolean);

  return lines.join("\n");
}

export async function queryMedGemmaPharmacyBrief(
  query: string
): Promise<MedGemmaPharmacyBrief> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      answer: "RINGKASAN: pertanyaan farmasi umum\nKEAMANAN: aman",
      model: "none",
      safetyLevel: "safe",
      shouldEscalate: false,
    };
  }

  const cfg = medGemmaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        messages: [
          { role: "system", content: buildPharmacySystemPrompt() },
          { role: "user", content: trimmed },
        ],
        options: {
          temperature: cfg.temperature,
          num_predict: cfg.maxTokens,
        },
      }),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`MedGemma pharmacy HTTP ${res.status}: ${raw.slice(0, 300)}`);

    const data = JSON.parse(raw) as {
      message?: { content?: string };
      model?: string;
      error?: string;
    };
    const answer = data.message?.content?.trim();
    if (!answer) throw new Error(data.error || "MedGemma farmasi respons kosong");

    const parsed = parseSafetyFromBrief(answer);
    return {
      answer,
      model: data.model ?? cfg.model,
      ...parsed,
    };
  } finally {
    clearTimeout(timeout);
  }
}
