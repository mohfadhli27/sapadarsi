export type OrchestratorProfile = {
  id: string;
  label: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  extraBody?: Record<string, unknown>;
};

const OLLAMA_FALLBACK_ID = "ollama-local-8b";
const DGX_PROFILE_ID = "ollama-dgx-8b";

const PROFILES: Record<string, OrchestratorProfile> = {
  [DGX_PROFILE_ID]: {
    id: DGX_PROFILE_ID,
    label: "Llama 3.1 8B (Ollama DGX)",
    apiBaseUrl: process.env.CHAT_API_BASE_URL?.trim() || "http://10.9.23.200:11434/v1",
    apiKey: process.env.CHAT_API_KEY?.trim() || "ollama",
    model:
      process.env.CHAT_MODEL?.trim() ||
      process.env.OLLAMA_ORCHESTRATOR_MODEL?.trim() ||
      "llama3.1:8b",
  },
  "nemotron-dgx": {
    id: "nemotron-dgx",
    label: "NVIDIA Nemotron 120B (vLLM DGX)",
    apiBaseUrl: "http://10.9.23.200:8000/v1",
    apiKey: "EMPTY",
    model: "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
    extraBody: {
      chat_template_kwargs: { enable_thinking: false },
    },
  },
  [OLLAMA_FALLBACK_ID]: {
    id: OLLAMA_FALLBACK_ID,
    label: "Ollama lokal (fallback)",
    apiBaseUrl: "http://127.0.0.1:11434/v1",
    apiKey: "ollama",
    model: process.env.OLLAMA_LOCAL_FALLBACK_MODEL?.trim() || "llama3.1:8b",
  },
};

/** Cooldown setelah Nemotron gagal — hindari retry berulang ke server mati. */
const PRIMARY_COOLDOWN_MS = Number(process.env.LLM_PRIMARY_COOLDOWN_MS || "60000");
const unhealthyUntil = new Map<string, number>();

function getOllamaFallbackProfile(): OrchestratorProfile {
  return PROFILES[OLLAMA_FALLBACK_ID];
}

function isProfileOnCooldown(profileId: string): boolean {
  const until = unhealthyUntil.get(profileId);
  return until !== undefined && Date.now() < until;
}

function markProfileUnavailable(profileId: string) {
  if (profileId === OLLAMA_FALLBACK_ID) return;
  unhealthyUntil.set(profileId, Date.now() + PRIMARY_COOLDOWN_MS);
  console.warn(
    `[orchestrator] ${profileId} offline — switch ke Ollama selama ${Math.round(PRIMARY_COOLDOWN_MS / 1000)}s`
  );
}

function markProfileAvailable(profileId: string) {
  unhealthyUntil.delete(profileId);
}

export function resolveOrchestratorProfile(): OrchestratorProfile {
  const configured = process.env.LLM_PROFILE?.trim();
  // Sama seperti chatbot: default Ollama DGX; Nemotron tidak dipakai.
  const profileId =
    !configured || configured === "nemotron-dgx" ? DGX_PROFILE_ID : configured;
  const profile = PROFILES[profileId];
  if (profile) return profile;

  return {
    id: "custom",
    label: "Kustom env",
    apiBaseUrl:
      process.env.NEMOTRON_API_BASE_URL?.trim() ||
      process.env.CHAT_API_BASE_URL?.trim() ||
      "http://10.9.23.200:11434/v1",
    apiKey: process.env.NEMOTRON_API_KEY?.trim() || process.env.CHAT_API_KEY?.trim() || "ollama",
    model:
      process.env.NEMOTRON_MODEL?.trim() ||
      process.env.CHAT_MODEL?.trim() ||
      "llama3.1:8b",
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
  };
}

/** Profil aktif: Nemotron jika hidup, otomatis Ollama jika primary cooldown. */
export function resolveActiveOrchestratorProfile(): OrchestratorProfile {
  const primary = resolveOrchestratorProfile();
  const fallback = getOllamaFallbackProfile();
  if (primary.id === fallback.id) return primary;
  if (isProfileOnCooldown(primary.id)) return fallback;
  return primary;
}

function profilesToTry(preferred?: OrchestratorProfile): OrchestratorProfile[] {
  const fallback = getOllamaFallbackProfile();
  const primary = preferred ?? resolveOrchestratorProfile();

  if (primary.id === fallback.id) return [primary];
  if (preferred) {
    if (isProfileOnCooldown(primary.id)) return [fallback];
    return [primary, fallback];
  }
  if (isProfileOnCooldown(primary.id)) return [fallback];
  return [primary, fallback];
}

async function chatCompletionsOnce(input: {
  system: string;
  user: string;
  jsonMode?: boolean;
  profile: OrchestratorProfile;
}): Promise<{ content: string; profileId: string; model: string }> {
  const { profile } = input;
  const url = `${profile.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;

  const body: Record<string, unknown> = {
    model: profile.model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    temperature: 0.3,
    ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(profile.extraBody ?? {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Orchestrator HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }

  let data: {
    choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error(`Orchestrator JSON tidak valid: ${raw.slice(0, 200)}`);
  }

  if (data.error?.message) throw new Error(data.error.message);

  const message = data.choices?.[0]?.message;
  const content = (message?.content || message?.reasoning || "").trim();
  if (!content) throw new Error("Orchestrator mengembalikan respons kosong");

  markProfileAvailable(profile.id);
  return { content, profileId: profile.id, model: profile.model };
}

export async function chatCompletions(input: {
  system: string;
  user: string;
  jsonMode?: boolean;
  profile?: OrchestratorProfile;
}): Promise<{ content: string; profileId: string; model: string }> {
  const candidates = profilesToTry(input.profile);
  let lastError: unknown;

  for (const profile of candidates) {
    try {
      return await chatCompletionsOnce({ ...input, profile });
    } catch (error) {
      lastError = error;
      if (profile.id !== getOllamaFallbackProfile().id) {
        markProfileUnavailable(profile.id);
        console.warn(`[orchestrator] ${profile.id} gagal, coba Ollama`, error);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Orchestrator gagal tanpa detail error");
}

export async function chatCompletionsWithFallback(input: {
  system: string;
  user: string;
  jsonMode?: boolean;
}): Promise<{ content: string; profileId: string; model: string }> {
  return chatCompletions(input);
}

/** Streaming chat/completions — auto-switch ke Ollama jika Nemotron mati. */
export async function fetchOrchestratorChatStream(input: {
  body: Record<string, unknown>;
}): Promise<{ response: Response; profile: OrchestratorProfile }> {
  const candidates = profilesToTry();
  let lastError: unknown;

  for (const profile of candidates) {
    const url = `${profile.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${profile.apiKey}`,
        },
        body: JSON.stringify({
          ...input.body,
          model: profile.model,
          stream: true,
          ...(profile.extraBody ?? {}),
        }),
        signal: AbortSignal.timeout(180_000),
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Orchestrator HTTP ${response.status}: ${detail.slice(0, 200)}`);
      }

      markProfileAvailable(profile.id);
      if (profile.id !== candidates[0]?.id) {
        console.info(`[orchestrator] streaming via ${profile.id} (fallback)`);
      }
      return { response, profile };
    } catch (error) {
      lastError = error;
      if (profile.id !== getOllamaFallbackProfile().id) {
        markProfileUnavailable(profile.id);
        console.warn(`[orchestrator] stream ${profile.id} gagal, coba Ollama`, error);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Orchestrator stream gagal tanpa detail error");
}
