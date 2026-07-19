/**
 * MedGemma — modul analisis klinis internal (tool untuk orchestrator Nemotron).
 * Selaras dengan chatbot-agent-cs/src/lib/medGemmaClient.ts
 */

const DEFAULT_MODEL = "medgemma:4b";
const DEFAULT_ENDPOINT = "http://10.9.23.200:11434/api/chat";

function medGemmaConfig() {
  return {
    model: process.env.MEDGEMMA_OLLAMA_MODEL?.trim() || DEFAULT_MODEL,
    endpoint:
      process.env.MEDGEMMA_OLLAMA_CHAT_URL?.trim() ||
      `${(process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/chat`,
    temperature: Number(process.env.MEDGEMMA_TEMPERATURE || "0.1"),
    maxTokens: Number(process.env.MEDGEMMA_MAX_TOKENS || "512"),
    timeoutMs: Number(process.env.MEDGEMMA_TIMEOUT_MS || "90000"),
  };
}

function buildClinicalSystemPrompt() {
  return [
    "Anda modul analisis klinis DARSI (MedGemma) — INTERNAL untuk dokter/orchestrator.",
    "Tugas: ringkas keluhan, perkirakan tingkat risiko, saran poli, dan opsi ICD-10 jika relevan.",
    "DILARANG menyebut chatbot, AI, atau jadwal praktik spesifik.",
    "Jangan diagnosis final; ini brief klinis untuk dokter.",
    "",
    "Format output (teks, bukan JSON):",
    "GEJALA: ringkas hanya dari konteks chat — jangan mengarang",
    "RISIKO: rendah|sedang|tinggi",
    "CATATAN KLINIS: ...",
    "PERTANYAAN SOAL SUGGEST: tepat satu pertanyaan wawancara berikutnya yang belum terjawab di riwayat",
    "ICD SUGGEST: [kode] — [nama] (opsional)",
    "ESKALASI IGD: ya/tidak + alasan singkat",
  ].join("\n");
}

export type MedGemmaClinicalBrief = {
  answer: string;
  model: string;
  riskLevel: "low" | "medium" | "high";
  shouldEscalate: boolean;
};

function parseRiskFromBrief(text: string): {
  riskLevel: "low" | "medium" | "high";
  shouldEscalate: boolean;
} {
  const lower = text.toLowerCase();
  let riskLevel: "low" | "medium" | "high" = "low";
  if (/risiko:\s*tinggi|risiko tinggi|eskalasi igd:\s*ya/i.test(text)) {
    riskLevel = "high";
  } else if (/risiko:\s*sedang|risiko sedang/i.test(text)) {
    riskLevel = "medium";
  }
  const shouldEscalate =
    riskLevel === "high" ||
    /eskalasi igd:\s*ya|nyeri dada|sesak|pingsan|perdarahan/i.test(lower);
  return { riskLevel, shouldEscalate };
}

export async function queryMedGemmaClinicalBrief(
  medicalQuery: string
): Promise<MedGemmaClinicalBrief> {
  const trimmed = medicalQuery.trim();
  if (!trimmed) {
    return {
      answer: "GEJALA: tidak ada\nRISIKO: rendah\nCATATAN KLINIS: -",
      model: "none",
      riskLevel: "low",
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
          { role: "system", content: buildClinicalSystemPrompt() },
          { role: "user", content: trimmed },
        ],
        options: {
          temperature: cfg.temperature,
          num_predict: cfg.maxTokens,
        },
      }),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`MedGemma HTTP ${res.status}: ${raw.slice(0, 300)}`);

    const data = JSON.parse(raw) as {
      message?: { content?: string };
      model?: string;
      error?: string;
    };
    const answer = data.message?.content?.trim();
    if (!answer) throw new Error(data.error || "MedGemma respons kosong");

    const parsed = parseRiskFromBrief(answer);
    return {
      answer,
      model: data.model ?? cfg.model,
      ...parsed,
    };
  } finally {
    clearTimeout(timeout);
  }
}
