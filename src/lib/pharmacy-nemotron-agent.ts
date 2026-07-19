import { dbQuery } from "@/src/lib/db";
import { enrichPharmacyMessage } from "@/src/lib/pharmacy-db-service";
import { patientFirstName, type PharmacyIntent } from "@/src/lib/pharmacy-intent";
import {
  buildPharmacyMedGemmaQuery,
  queryMedGemmaPharmacyBrief,
} from "@/src/lib/medgemma-pharmacy-client";
import {
  buildPharmacyStructuredResponse,
  shouldUseStructuredFallback,
} from "@/src/lib/pharmacy-response-builder";
import { fetchOrchestratorChatStream } from "@/src/lib/nemotron-orchestrator";
import { sanitizePharmacyResponse } from "@/src/lib/pharmacy-response-format";
import { currentAppPublicUrl } from "@/src/lib/session-app-origin";

type MessageRow = {
  id: number;
  sender_type: string;
  message_text: string;
  created_at: Date;
  tool_results: unknown;
};

type SessionRow = {
  id: number;
  patient_id: number | null;
  session_type: string;
  status: string;
  initial_complaint: string | null;
};

const PHARMACY_SYSTEM_PROMPT = `Anda adalah Asisten Apoteker DARSI — RSI Surabaya A. Yani.

Anda menyusun jawaban pasien dari data formularium internal + brief farmasi MedGemma (INTERNAL).
Jangan sebut AI, Nemotron, MedGemma, database, e-Fornas, atau label teknis.

## Gaya
- Bahasa Indonesia hangat, mudah dibaca di HP.
- Sapa dengan nama depan pasien bila tersedia ("Halo Budi,").
- Akhiri dengan penutup singkat ("Semoga membantu, Budi. Jika ada pertanyaan lain, saya di sini.").

## Aturan medis
- Jangan diagnosis. Jangan meresepkan obat baru.
- Hanya obat yang ada di konteks data — jangan mengarang.
- Gejala serius / overdosis → arahkan dokter atau IGD.

## Format wajib (interaksi / perbandingan 2+ obat)

Halo {nama},

Berikut perbandingan keduanya:

--- Obat 1: NAMA_OBAT ---
• **Fungsi:** ...
• **Bentuk & kekuatan:** ...
• **Cara pakai:** ...
• **Batas aman:** ...

--- Obat 2: NAMA_OBAT ---
(empat poin identik)

---

**Interaksi**

(paragraf naratif 3-5 kalimat: mekanisme, keamanan bersamaan, jarak waktu minum, kapan ke dokter)

Semoga membantu, {nama}. Jika ada pertanyaan lain, saya di sini.

## Format info satu obat
Satu kartu dengan 4 poin identik di atas + penutup.

## Format dosis / keamanan
- Jawab langsung di awal: **Tidak disarankan** atau **Ikuti dosis resep dokter**.
- Singkat: sapaan → jawaban langsung → batas aman dari data → penutup.
- Tanpa section Interaksi kecuali ditanya.

## Larangan
- Empat poin kartu obat harus identik strukturnya.
- Membahas obat yang tidak ditanyakan.
- Menyalin mentah brief MedGemma — ubah ke bahasa pasien.`;

function intentMaxTokens(intent: PharmacyIntent): number {
  switch (intent) {
    case "interaction":
      return 1400;
    case "dose_safety":
    case "follow_up":
      return 700;
    case "drug_info":
      return 900;
    default:
      return 800;
  }
}

function buildConversationMessages(
  history: MessageRow[],
  latestMessage: string,
  options?: {
    patientName?: string;
    dbContext?: string;
  }
) {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: PHARMACY_SYSTEM_PROMPT },
  ];

  if (options?.patientName) {
    const first = patientFirstName(options.patientName);
    messages[0].content += first
      ? `\n\nNama pasien: ${options.patientName} (panggil: ${first})`
      : `\n\nNama pasien: ${options.patientName}`;
  }

  if (options?.dbContext) {
    messages[0].content += `\n\n${options.dbContext}`;
  }

  for (const row of history) {
    messages.push({
      role: row.sender_type === "patient" ? "user" : "assistant",
      content: row.message_text,
    });
  }

  messages.push({ role: "user", content: latestMessage });

  return messages;
}

export async function createPharmacySession(
  patientId: number,
  options?: { appOriginUrl?: string }
): Promise<SessionRow> {
  const appOriginUrl = options?.appOriginUrl ?? currentAppPublicUrl();
  const result = await dbQuery<SessionRow>(
    `INSERT INTO chat_sessions (patient_id, session_type, status, app_origin_url)
     VALUES ($1, 'pharmacist_consultation', 'active', $2)
     RETURNING id, patient_id, session_type, status, initial_complaint`,
    [patientId, appOriginUrl]
  );
  return result.rows[0];
}

export type PharmacyThreadSummary = {
  id: number;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export async function listPharmacySessions(
  patientId: number
): Promise<PharmacyThreadSummary[]> {
  const result = await dbQuery<{
    id: number;
    updated_at: Date;
    first_message: string | null;
    msg_count: string;
  }>(
    `SELECT
       s.id,
       s.updated_at,
       (SELECT message_text FROM chat_messages
        WHERE session_id = s.id AND sender_type = 'patient' AND hidden_at IS NULL
        ORDER BY id ASC LIMIT 1) AS first_message,
       (SELECT COUNT(*)::text FROM chat_messages
        WHERE session_id = s.id AND hidden_at IS NULL) AS msg_count
     FROM chat_sessions s
     WHERE s.patient_id = $1 AND s.session_type = 'pharmacist_consultation'
     ORDER BY s.updated_at DESC
     LIMIT 50`,
    [patientId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    title: r.first_message?.slice(0, 60) || "Chat baru",
    updatedAt: r.updated_at.toISOString(),
    messageCount: Number(r.msg_count),
  }));
}

export async function getPharmacySessionMessages(
  sessionId: number,
  patientId: number
) {
  const session = await dbQuery<SessionRow>(
    `SELECT id, patient_id, session_type, status, initial_complaint
     FROM chat_sessions WHERE id = $1 LIMIT 1`,
    [sessionId]
  );
  if (!session.rows[0] || session.rows[0].patient_id !== patientId) {
    throw new Error("Sesi tidak ditemukan");
  }
  return getSessionMessages(sessionId);
}

async function getSessionMessages(sessionId: number): Promise<MessageRow[]> {
  const result = await dbQuery<MessageRow>(
    `SELECT id, sender_type, message_text, created_at, tool_results
     FROM chat_messages
     WHERE session_id = $1 AND hidden_at IS NULL
     ORDER BY created_at ASC, id ASC`,
    [sessionId]
  );
  return result.rows;
}

export async function deletePharmacyMessage(
  sessionId: number,
  messageId: number,
  patientId: number
): Promise<void> {
  const session = await dbQuery<SessionRow>(
    `SELECT id, patient_id FROM chat_sessions WHERE id = $1 LIMIT 1`,
    [sessionId]
  );
  if (!session.rows[0] || session.rows[0].patient_id !== patientId) {
    throw new Error("Sesi tidak ditemukan");
  }

  const result = await dbQuery(
    `UPDATE chat_messages
     SET hidden_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND session_id = $2 AND hidden_at IS NULL`,
    [messageId, sessionId]
  );

  if (result.rowCount === 0) {
    throw new Error("Pesan tidak ditemukan");
  }

  await dbQuery(
    `UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [sessionId]
  );
}

export async function deletePharmacySession(
  sessionId: number,
  patientId: number
): Promise<void> {
  const session = await dbQuery<SessionRow>(
    `SELECT id, patient_id FROM chat_sessions WHERE id = $1 LIMIT 1`,
    [sessionId]
  );
  if (!session.rows[0] || session.rows[0].patient_id !== patientId) {
    throw new Error("Sesi tidak ditemukan");
  }

  await dbQuery(`DELETE FROM chat_sessions WHERE id = $1`, [sessionId]);
}

export async function streamPharmacyChat(input: {
  sessionId: number;
  patientId: number;
  patientName?: string;
  message: string;
}): Promise<Response> {
  const sessionCheck = await dbQuery<SessionRow>(
    `SELECT id, patient_id, session_type, status, initial_complaint
     FROM chat_sessions WHERE id = $1 LIMIT 1`,
    [input.sessionId]
  );
  const session = sessionCheck.rows[0];
  if (!session || session.patient_id !== input.patientId) {
    throw new Error("Sesi tidak ditemukan");
  }

  await dbQuery(
    `INSERT INTO chat_messages (session_id, sender_type, message_text)
     VALUES ($1, 'patient', $2)`,
    [session.id, input.message]
  );
  await dbQuery(
    `UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [session.id]
  );

  const history = await getSessionMessages(session.id);
  const priorHistory = history.slice(0, -1);

  const dbEnrichment = await enrichPharmacyMessage(
    input.message,
    priorHistory,
    input.patientName
  );

  let medgemmaBriefText = "";
  try {
    const medgemmaQuery = buildPharmacyMedGemmaQuery({
      message: input.message,
      intent: dbEnrichment.intent,
      focusDrugs: dbEnrichment.focusDrugs,
      dbContext: dbEnrichment.context,
    });
    const brief = await queryMedGemmaPharmacyBrief(medgemmaQuery);
    medgemmaBriefText = brief.answer;
  } catch (error) {
    console.warn("[pharmacy-agent] MedGemma brief gagal, lanjut tanpa brief", error);
  }

  const structuredFallback = buildPharmacyStructuredResponse({
    intent: dbEnrichment.intent,
    patientName: input.patientName,
    efornas: dbEnrichment.efornas,
    chronic: dbEnrichment.chronic,
    interactions: dbEnrichment.interactions,
    medgemmaBrief: medgemmaBriefText,
  });

  const messages = buildConversationMessages(
    priorHistory,
    input.message,
    {
      patientName: input.patientName,
      dbContext: [
        dbEnrichment.context,
        medgemmaBriefText
          ? `\n=== BRIEF FARMASI MEDGEMMA (INTERNAL — jangan kutip mentah) ===\n${medgemmaBriefText}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    }
  );

  const { response: llmRes } = await fetchOrchestratorChatStream({
    body: {
      messages,
      temperature: 0.38,
      max_tokens: intentMaxTokens(dbEnrichment.intent),
    },
  });

  const encoder = new TextEncoder();
  const reader = llmRes.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  const sessionId = session.id;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      emit({ type: "status", message: "Mencari data obat..." });
      if (medgemmaBriefText) {
        emit({ type: "status", message: "Menganalisis keamanan obat..." });
      }
      if (dbEnrichment.intent === "interaction" && dbEnrichment.hasDrugData) {
        emit({ type: "status", message: "Memeriksa interaksi obat..." });
      }

      let buffer = "";
      let saveError: unknown = null;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;

            const payload = trimmed.startsWith("data: ")
              ? trimmed.slice(6)
              : trimmed;

            try {
              const chunk = JSON.parse(payload) as {
                choices?: Array<{
                  delta?: { content?: string; reasoning?: string };
                }>;
              };

              const text =
                chunk.choices?.[0]?.delta?.content ??
                chunk.choices?.[0]?.delta?.reasoning;

              if (text) {
                fullResponse += text;
                emit({ type: "text-delta", text });
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (error) {
        saveError = error;
        emit({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Gagal memproses respons apoteker",
        });
      }

      let cleaned = sanitizePharmacyResponse(fullResponse);

      if (
        structuredFallback &&
        (shouldUseStructuredFallback(cleaned, dbEnrichment.intent, dbEnrichment.hasDrugData) ||
          !cleaned.trim())
      ) {
        cleaned = sanitizePharmacyResponse(structuredFallback);
        emit({ type: "text-replace", text: cleaned });
        fullResponse = cleaned;
      } else if (cleaned !== fullResponse.trim()) {
        emit({ type: "text-replace", text: cleaned });
        fullResponse = cleaned;
      }

      if (fullResponse.trim()) {
        try {
          await dbQuery(
            `INSERT INTO chat_messages (session_id, sender_type, message_text)
             VALUES ($1, 'ai', $2)`,
            [sessionId, fullResponse.trim()]
          );
          await dbQuery(
            `UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [sessionId]
          );
        } catch (e) {
          console.error("[pharmacy-agent] Failed to save AI response:", e);
        }
      }

      try {
        controller.close();
      } catch {
        // stream may already be closed
      }
      reader.releaseLock();

      if (saveError) {
        console.error("[pharmacy-agent] Stream error:", saveError);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
