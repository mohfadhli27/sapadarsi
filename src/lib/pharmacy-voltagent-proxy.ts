const PHARMACY_VOLT_URL =
  process.env.PHARMACY_VOLT_AGENT_URL ?? "http://127.0.0.1:1337";
const PHARMACY_AGENT_NAME =
  process.env.PHARMACY_VOLT_AGENT_NAME ?? "DARSI Apoteker Screening";
const PHARMACY_TIMEOUT_MS = Number(
  process.env.PHARMACY_VOLT_AGENT_TIMEOUT_MS ?? 280_000
);

type ChatInputMessage = {
  id?: string;
  role: string;
  content: string;
};

type VoltAgentStreamEvent = {
  type?: string;
  text?: string;
  delta?: string;
  textDelta?: string;
  toolName?: string;
  name?: string;
  message?: string;
};

const TOOL_STATUS: Record<string, string> = {
  search_icd_code: "Mencari kode ICD...",
  "search-medicines": "Mencari data obat RSI...",
  "recommend-medicines": "Mencari rekomendasi obat...",
  "search-efornas": "Mencari data e-Fornas...",
  check_medication_interaction: "Memeriksa interaksi obat...",
  "get-live-system-status": "Memeriksa status apotek...",
};

function parseVoltAgentLine(line: string): VoltAgentStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "[DONE]") return null;

  const payload = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
  try {
    return JSON.parse(payload) as VoltAgentStreamEvent;
  } catch {
    return null;
  }
}

function extractTextDelta(event: VoltAgentStreamEvent): string | null {
  const chunk = event.text ?? event.delta ?? event.textDelta;
  return typeof chunk === "string" && chunk.length > 0 ? chunk : null;
}

function buildPharmacyAgentContext(input: {
  patientName?: string;
  noRm?: string;
  patientId?: number;
}) {
  return {
    viewerRole: "pasien",
    role: "pasien",
    userRole: "pasien",
    loginRole: "pasien",
    darsiRole: "pasien",
    sessionSource: "darsi-patient-frontend",
    isAuthenticated: true,
    ...(input.patientName ? { patientName: input.patientName } : {}),
    ...(input.noRm ? { noRm: input.noRm } : {}),
    ...(input.patientId ? { patientId: input.patientId } : {}),
  };
}

function isMeaningfulTextDelta(text: string): boolean {
  return text.replace(/\s+/g, "").length > 0;
}

function toolStatusMessage(event: VoltAgentStreamEvent): string | null {
  if (typeof event.message === "string" && event.message.trim()) {
    return event.message.trim();
  }
  const tool = event.toolName ?? event.name;
  if (!tool) return null;
  return TOOL_STATUS[tool] ?? `Memproses ${tool.replace(/_/g, " ")}...`;
}

export async function proxyPharmacyAgentStream(input: {
  messages: ChatInputMessage[];
  conversationId?: string;
  patientName?: string;
  noRm?: string;
  patientId?: number;
}): Promise<Response> {
  const agentPath = encodeURIComponent(PHARMACY_AGENT_NAME);
  const url = `${PHARMACY_VOLT_URL.replace(/\/$/, "")}/agents/${agentPath}/stream`;

  const backendMessages = input.messages.map((message, index) => ({
    id: message.id ?? `msg-${index}`,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHARMACY_TIMEOUT_MS);

  const conversationId =
    input.conversationId ??
    (input.patientId
      ? `apoteker-patient-${input.patientId}-${Date.now()}`
      : `apoteker-${Date.now()}`);

  const userId = input.patientId
    ? `patient-${input.patientId}`
    : `guest-${conversationId}`;

  let backendRes: Response;
  try {
    backendRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: backendMessages,
        options: {
          conversationId,
          userId,
          context: buildPharmacyAgentContext(input),
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!backendRes.ok || !backendRes.body) {
    const detail = await backendRes.text().catch(() => "");
    throw new Error(
      `Agent apoteker tidak merespons (${backendRes.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }

  const encoder = new TextEncoder();
  const reader = backendRes.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const event = parseVoltAgentLine(line);
            if (!event?.type) continue;

            if (
              event.type === "tool-call" ||
              event.type === "tool-input-start"
            ) {
              const status = toolStatusMessage(event);
              if (status) emit({ type: "status", message: status });
              continue;
            }

            if (event.type === "text-delta") {
              const text = extractTextDelta(event);
              if (text && isMeaningfulTextDelta(text)) {
                emit({ type: "text-delta", text });
              }
            }
          }
        }
      } catch (error) {
        emit({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Gagal memproses respons apoteker",
        });
      } finally {
        controller.close();
        reader.releaseLock();
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
