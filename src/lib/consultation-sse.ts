import type { NextRequest } from "next/server";
import { dbQuery } from "@/src/lib/db";
import { getConsultationEventSnapshot, getVisibleMessages } from "@/src/lib/doctor-consultation-service";
import { getMidwifeVisibleMessages } from "@/src/lib/consultation-service";

const DEFAULT_SSE_INTERVAL_MS = 400;

type VisibleMessage = {
  id: number;
  role: string;
  text: string;
  senderName?: string;
  createdAt: Date | string;
  isTakeover?: boolean;
  suggestNewConsultation?: unknown;
};

function serializeMessages(messages: VisibleMessage[]) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    senderName: m.senderName,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    isTakeover: Boolean(m.isTakeover),
    suggestNewConsultation: m.suggestNewConsultation,
  }));
}

async function resolveMessageLoader(sessionId: number) {
  const result = await dbQuery<{ session_type: string }>(
    `select session_type from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const sessionType = result.rows[0]?.session_type;
  if (sessionType === "midwife_consultation" || sessionType === "nurse_consultation") {
    return getMidwifeVisibleMessages;
  }
  return getVisibleMessages;
}

export function createConsultationSseStream(
  sessionId: number,
  req: NextRequest,
  intervalMs = DEFAULT_SSE_INTERVAL_MS
) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const loadMessages = await resolveMessageLoader(sessionId);
      let lastStatus = "";
      let lastUiPhase = "";
      let lastTakeover = false;
      let lastMessagesHash = "";
      let lastPrescriptionHash = "";
      let closed = false;

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const tick = async () => {
        if (closed) return;
        try {
          const snap = await getConsultationEventSnapshot(sessionId);
          if (!snap) {
            send("error", { message: "Sesi tidak ditemukan" });
            closed = true;
            controller.close();
            return;
          }

          if (
            snap.status !== lastStatus ||
            snap.uiPhase !== lastUiPhase ||
            snap.doctorTakeoverActive !== lastTakeover
          ) {
            lastStatus = snap.status;
            lastUiPhase = snap.uiPhase;
            lastTakeover = snap.doctorTakeoverActive;
            send("status", {
              status: snap.status,
              uiPhase: snap.uiPhase,
              doctorTakeoverActive: snap.doctorTakeoverActive,
              updatedAt: snap.updatedAt,
            });
          }

          if (snap.messagesHash !== lastMessagesHash) {
            const messages = await loadMessages(sessionId);
            lastMessagesHash = snap.messagesHash;
            send("messages", { messages: serializeMessages(messages) });
          }

          if (snap.prescriptionHash !== lastPrescriptionHash) {
            lastPrescriptionHash = snap.prescriptionHash;
            send("prescription", { updated: true });
          }

          send("ping", { t: Date.now() });
        } catch (error) {
          send("error", {
            message: error instanceof Error ? error.message : "Stream error",
          });
        }
      };

      await tick();
      const interval = setInterval(() => void tick(), intervalMs);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/** @deprecated Gunakan createConsultationSseStream — sudah otomatis deteksi tipe sesi. */
export function createMidwifeConsultationSseStream(
  sessionId: number,
  req: NextRequest,
  intervalMs = DEFAULT_SSE_INTERVAL_MS
) {
  return createConsultationSseStream(sessionId, req, intervalMs);
}
