import { randomBytes } from "crypto";
import { z } from "zod";
import { dbQuery } from "@/src/lib/db";
import type { ConsultationServiceType } from "@/src/config/consultation";
import {
  buildApprovalRequestText,
  practitionerRoleLabel,
  sendConsultationApprovalRequest,
} from "@/src/lib/telegram-service";
import { notifyStaffConsultationRequest } from "@/src/lib/staff-notification-service";
import { currentAppPublicUrl } from "@/src/lib/session-app-origin";
import { buildConsultationSummaryCard } from "@/src/lib/consultation-completion";
import {
  recommendPractitionersFromComplaint,
  recommendationsToSlots,
  filterMidwifePractitionerSlots,
} from "@/src/lib/midwife-triage";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://10.9.23.200:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "medgemma:4b";

const aiResponseSchema = z.object({
  reply: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
  recommendation: z.string(),
  shouldEscalate: z.boolean(),
});

export type ConsultationAiResponse = z.infer<typeof aiResponseSchema>;

type PatientRow = {
  id: number;
  nama: string | null;
  no_rm: string;
  sex?: string | null;
  tgl_lahir?: string | null;
};
type SessionRow = {
  id: number;
  patient_id: number | null;
  session_type: string;
  status: string;
  initial_complaint: string | null;
};
type MessageRow = {
  id: number;
  sender_type: string;
  message_text: string;
  edited_text?: string | null;
  hidden_at?: Date | null;
  staff_actor?: string | null;
  created_at: Date;
};

import {
  buildMidwifeSystemPrompt,
  sanitizeMidwifeReplyText,
  buildMidwifeUserPrompt,
  resolveMidwifeHonorific,
  fixMidwifePatientAddress,
  mapMidwifeRowToVisibleMessage,
} from "@/src/lib/midwife-consultation-format";
import { runMidwifeAgent, type MidwifeAgentContext, type MidwifeAgentResult } from "@/src/lib/midwife-agent";
import { runMidwifeOllamaAgent } from "@/src/lib/midwife-ollama-agent";
import { getReplyValidationIssue } from "@/src/lib/agent-reply-validator";
import { buildSoftAssessmentReply } from "@/src/lib/interview-phase";
import { calcPatientAge } from "@/src/lib/patient-address";
import {
  mapMidwifeHistoryFromThread,
  type AgentThreadRow,
} from "@/src/lib/consultation-thread-context";
import { dedupeLatestPatientTurn } from "@/src/lib/interview-context";
import {
  isSessionTakeoverActive,
  resolveSessionPractitionerName,
} from "@/src/lib/session-practitioner";

function serviceLabel(serviceType: ConsultationServiceType) {
  return serviceType === "midwife_consultation" ? "bidan" : "perawat";
}

function createMonitorToken() {
  return randomBytes(24).toString("hex");
}

async function setMidwifeConsultationUiPhase(sessionId: number, uiPhase: string) {
  await dbQuery(
    `update doctor_consultation_meta
     set ui_phase = $2, updated_at = current_timestamp
     where session_id = $1`,
    [sessionId, uiPhase]
  );
}

function buildSystemPrompt(honorific: string, isFollowUp = false) {
  return buildMidwifeSystemPrompt(honorific, isFollowUp);
}

function parseAiResponse(raw: string): ConsultationAiResponse {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      reply: raw.trim() || "Maaf, saya belum dapat memproses keluhan Anda. Silakan coba lagi.",
      riskLevel: "low",
      recommendation: "Konsultasikan keluhan Anda dengan tenaga kesehatan jika berlanjut.",
      shouldEscalate: false,
    };
  }

  try {
    const parsed = aiResponseSchema.parse(JSON.parse(jsonMatch[0]));
    return parsed;
  } catch {
    return {
      reply: raw.trim(),
      riskLevel: "low",
      recommendation: "Konsultasikan keluhan Anda dengan tenaga kesehatan jika berlanjut.",
      shouldEscalate: false,
    };
  }
}

async function callConsultationAgent(
  prompt: string,
  honorific: string,
  isFollowUp = false
) {
  const res = await fetch(`${OLLAMA_HOST.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: buildSystemPrompt(honorific, isFollowUp) },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`Ollama error (${res.status})`);
  }

  const data = (await res.json()) as { message?: { content?: string }; error?: string };
  if (data.error) throw new Error(data.error);

  return parseAiResponse(data.message?.content ?? "");
}

async function loadMidwifePatient(patientId: number) {
  const patientResult = await dbQuery<PatientRow>(
    `select id, nama, no_rm, sex, tgl_lahir from pasienkonsul.b_ms_pasien where id = $1 limit 1`,
    [patientId]
  );
  const patient = patientResult.rows[0];
  if (!patient?.nama) throw new Error("Data pasien tidak valid");
  return patient;
}

function mapMidwifeAgentHistory(messages: AgentThreadRow[]) {
  return mapMidwifeHistoryFromThread(messages);
}

function resolveMidwifeAgentPhase(
  history: ReturnType<typeof mapMidwifeAgentHistory>,
  openingLive?: boolean
): "greeting" | "consultation" {
  if (openingLive) return "greeting";
  const hasMidwifeReply = history.some((m) => m.role === "midwife");
  return hasMidwifeReply ? "consultation" : "greeting";
}

async function runMidwifeAgentWithFallback(ctx: MidwifeAgentContext): Promise<MidwifeAgentResult> {
  const validationCtx = {
    latestMessage: ctx.latestMessage,
    initialComplaint: ctx.initialComplaint,
    history: ctx.history,
  };

  try {
    const result = await runMidwifeAgent(ctx);
    if (!getReplyValidationIssue(result.reply, validationCtx)) {
      return result;
    }
    console.warn("[midwife] Respons Nemotron ditolak validator, fallback Ollama");
  } catch (error) {
    console.warn("[midwife] Nemotron+MedGemma gagal, fallback Ollama lokal", error);
  }

  try {
    const fallback = await runMidwifeOllamaAgent(ctx);
    if (!getReplyValidationIssue(fallback.reply, validationCtx)) {
      return fallback;
    }
  } catch (error) {
    console.warn("[midwife] Ollama fallback gagal", error);
  }

  return {
    reply: buildSoftAssessmentReply({
      honorific: ctx.patientHonorific,
      history: ctx.history,
      latestMessage: ctx.latestMessage,
      initialComplaint: ctx.initialComplaint,
    }),
    riskLevel: "low",
    recommendation: "",
    shouldEscalate: false,
    meta: {
      orchestratorProfile: "soft-assessment",
      orchestratorModel: "n/a",
      medgemmaModel: "n/a",
      stack: "soft-assessment-fallback",
    },
  };
}

async function runMidwifeAgentTurn(input: {
  sessionId: number;
  patientId: number;
  session: SessionRow;
  latestMessage: string;
  openingLive?: boolean;
  historyOverride?: MessageRow[];
}) {
  const patient = await loadMidwifePatient(input.patientId);
  const patientName = patient.nama ?? "Pasien";
  const honorific = resolveMidwifeHonorific({
    nama: patientName,
    sex: patient.sex,
    tgl_lahir: patient.tgl_lahir,
  });

  const meta = await dbQuery<{ doctor_name: string | null }>(
    `select doctor_name from doctor_consultation_meta where session_id = $1 limit 1`,
    [input.sessionId]
  );
  const practitionerName = meta.rows[0]?.doctor_name?.trim() || "Tim Bidan RSI";

  const history = input.historyOverride ?? (await getAgentContextMessages(input.sessionId));
  let agentHistory = mapMidwifeAgentHistory(history);
  agentHistory = dedupeLatestPatientTurn(agentHistory, input.latestMessage);
  const phase = resolveMidwifeAgentPhase(agentHistory, input.openingLive);
  const agentCtx: MidwifeAgentContext = {
    phase,
    practitionerName,
    patientName,
    patientHonorific: honorific,
    patientAge: calcPatientAge(patient.tgl_lahir),
    patientSex: patient.sex,
    initialComplaint: input.session.initial_complaint,
    history: agentHistory,
    latestMessage: input.latestMessage,
    openingLive: input.openingLive,
  };

  const agentResult = await runMidwifeAgentWithFallback(agentCtx);
  const aiResponse: ConsultationAiResponse = {
    reply: agentResult.reply,
    riskLevel: agentResult.riskLevel,
    recommendation: agentResult.recommendation,
    shouldEscalate: agentResult.shouldEscalate,
  };
  const agentMeta = agentResult.meta as Record<string, unknown> | undefined;

  aiResponse.reply = fixMidwifePatientAddress(
    sanitizeMidwifeReplyText(aiResponse.reply),
    honorific
  );

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text, staff_actor, tool_results)
     values ($1, 'ai', $2, $3, $4::jsonb)`,
    [
      input.sessionId,
      aiResponse.reply,
      practitionerName,
      JSON.stringify({
        riskLevel: aiResponse.riskLevel,
        recommendation: aiResponse.recommendation,
        shouldEscalate: aiResponse.shouldEscalate,
        ...(input.openingLive ? { liveOpening: true } : {}),
        ...(agentMeta ? { agentStack: agentMeta } : {}),
      }),
    ]
  );

  await dbQuery(
    `update chat_sessions set updated_at = current_timestamp where id = $1`,
    [input.sessionId]
  );

  if (aiResponse.shouldEscalate) {
    await dbQuery(
      `insert into chatbot_handoff_cases (session_id, patient_id, reason, status, created_at, updated_at)
       select $1, $2, $3, 'open', current_timestamp, current_timestamp
       where not exists (
         select 1 from chatbot_handoff_cases where session_id = $1 and status = 'open'
       )`,
      [
        input.sessionId,
        input.patientId,
        aiResponse.recommendation || "Eskalasi otomatis dari AI",
      ]
    ).catch(() => undefined);
  }

  return aiResponse;
}

function resolveOpeningComplaint(session: SessionRow, history: MessageRow[]): string {
  const fromSession = session.initial_complaint?.trim();
  if (fromSession) return fromSession;

  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].sender_type === "patient" && history[i].message_text?.trim()) {
      return history[i].message_text.trim();
    }
  }

  return "Pasien membutuhkan konsultasi bidan/perawat.";
}

export async function generateMidwifeLiveOpeningReply(sessionId: number, patientId: number) {
  const sessionResult = await dbQuery<SessionRow>(
    `select id, patient_id, session_type, status, initial_complaint
     from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const session = sessionResult.rows[0];
  if (!session || session.patient_id !== patientId) return null;

  const existingLiveOpening = await dbQuery<{ id: number }>(
    `select id from chat_messages
     where session_id = $1
       and sender_type = 'ai'
       and coalesce(tool_results->>'liveOpening', 'false') = 'true'
     limit 1`,
    [sessionId]
  );
  if (existingLiveOpening.rows[0]) return null;

  const history = await getAgentContextMessages(sessionId);
  const complaint = resolveOpeningComplaint(session, history);
  if (!complaint) return null;

  return runMidwifeAgentTurn({
    sessionId,
    patientId,
    session,
    latestMessage: complaint,
    openingLive: true,
    historyOverride: history,
  });
}

export async function createConsultationSession(input: {
  patientId: number;
  serviceType: ConsultationServiceType;
  initialComplaint?: string;
}) {
  const patientResult = await dbQuery<PatientRow>(
    `select id, nama, no_rm from pasienkonsul.b_ms_pasien where id = $1 limit 1`,
    [input.patientId]
  );
  const patient = patientResult.rows[0];
  if (!patient) {
    throw new Error("Pasien tidak ditemukan");
  }

  const sessionResult = await dbQuery<SessionRow>(
    `insert into chat_sessions (patient_id, session_type, status, initial_complaint, app_origin_url)
     values ($1, $2, 'triage', $3, $4)
     returning id, patient_id, session_type, status, initial_complaint`,
    [input.patientId, input.serviceType, input.initialComplaint ?? null, currentAppPublicUrl()]
  );

  const session = sessionResult.rows[0];

  if (
    input.serviceType === "midwife_consultation" ||
    input.serviceType === "nurse_consultation"
  ) {
    await dbQuery(
      `insert into doctor_consultation_meta (session_id, monitor_token, ui_phase)
       values ($1, $2, 'triage')
       on conflict (session_id) do nothing`,
      [session.id, createMonitorToken()]
    );
  }

  return {
    session,
    patient: {
      id: patient.id,
      name: patient.nama,
      noRm: patient.no_rm,
    },
  };
}

export async function getAgentContextMessages(sessionId: number): Promise<MessageRow[]> {
  const result = await dbQuery<MessageRow>(
    `select id, sender_type, message_text, edited_text, hidden_at, staff_actor, created_at
     from chat_messages
     where session_id = $1 and hidden_at is null
     order by created_at asc, id asc`,
    [sessionId]
  );
  return result.rows;
}

export async function getSessionMessages(sessionId: number) {
  const result = await dbQuery<MessageRow>(
    `select id, sender_type, message_text, edited_text, created_at
     from chat_messages
     where session_id = $1
     order by created_at asc, id asc`,
    [sessionId]
  );
  return result.rows;
}

export async function sendConsultationMessage(input: {
  sessionId: number;
  patientId: number;
  message: string;
}) {
  const sessionResult = await dbQuery<SessionRow>(
    `select id, patient_id, session_type, status, initial_complaint
     from chat_sessions
     where id = $1
     limit 1`,
    [input.sessionId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.patient_id !== input.patientId) throw new Error("Sesi bukan milik pasien ini");
  if (session.status === "completed" || session.status === "closed") {
    throw new Error("Sesi sudah ditutup");
  }

  const serviceType = session.session_type as ConsultationServiceType;
  if (serviceType !== "nurse_consultation" && serviceType !== "midwife_consultation") {
    throw new Error("Tipe sesi tidak didukung");
  }

  const patient = await loadMidwifePatient(input.patientId);

  if (await isSessionTakeoverActive(input.sessionId)) {
    await dbQuery(
      `insert into chat_messages (session_id, sender_type, message_text)
       values ($1, 'patient', $2)`,
      [input.sessionId, input.message]
    );
    await dbQuery(
      `update chat_sessions set updated_at = current_timestamp where id = $1`,
      [input.sessionId]
    );
    return {
      reply: "",
      riskLevel: "low" as const,
      recommendation: "",
      shouldEscalate: false,
      awaitingStaff: true,
      staffTakeoverActive: true,
    };
  }

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text)
     values ($1, 'patient', $2)`,
    [input.sessionId, input.message]
  );

  const history = await getAgentContextMessages(input.sessionId);
  const priorHistory = history.slice(0, -1);
  // historyOverride untuk agent: tanpa duplikasi pesan pasien terbaru (sudah di latestMessage)

  const aiResponse = await runMidwifeAgentTurn({
    sessionId: input.sessionId,
    patientId: input.patientId,
    session,
    latestMessage: input.message,
    historyOverride: priorHistory,
  });

  const nextStatus = session.status === "triage" ? "active" : session.status;
  await dbQuery(
    `update chat_sessions set status = $2, updated_at = current_timestamp where id = $1`,
    [input.sessionId, nextStatus]
  );

  return aiResponse;
}

export async function completeConsultationSession(sessionId: number, patientId: number) {
  const result = await dbQuery<SessionRow>(
    `update chat_sessions
     set status = 'completed', completed_at = current_timestamp, closed_at = current_timestamp, updated_at = current_timestamp
     where id = $1 and patient_id = $2
     returning id, patient_id, session_type, status, initial_complaint`,
    [sessionId, patientId]
  );
  if (!result.rows[0]) throw new Error("Sesi tidak ditemukan");
  return result.rows[0];
}

export async function completeMidwifeSession(sessionId: number, patientId: number) {
  const session = await getMidwifeSession(sessionId, patientId);

  if (session.status === "completed") {
    const meta = await dbQuery<{ summary_card: unknown }>(
      `select summary_card from doctor_consultation_meta where session_id = $1 limit 1`,
      [sessionId]
    );
    return {
      status: "completed" as const,
      summaryCard: meta.rows[0]?.summary_card ?? null,
      alreadyCompleted: true,
    };
  }

  if (session.status === "rejected") {
    throw new Error("Sesi konsultasi sudah ditolak");
  }

  const summaryCard = await buildConsultationSummaryCard(sessionId, "midwife_consultation").catch(
    (error) => {
      console.warn("[completeMidwifeSession] summary fallback", error);
      return {
        completedAt: new Date().toISOString(),
        advice:
          "Istirahat cukup, jaga asupan nutrisi, dan ikuti anjuran bidan/perawat. Segera ke IGD jika gejala memburuk.",
        summaryText: "Pasien menyelesaikan sesi konsultasi bidan/perawat melalui DARSI.",
        keyFindings: [] as string[],
        complaint: session.initial_complaint,
      };
    }
  );

  const updated = await dbQuery<{ id: number }>(
    `update chat_sessions
     set status = 'completed',
         completed_at = current_timestamp,
         closed_at = current_timestamp,
         updated_at = current_timestamp
     where id = $1 and patient_id = $2 and status not in ('completed', 'rejected')
     returning id`,
    [sessionId, patientId]
  );

  if (!updated.rows[0]) {
    const meta = await dbQuery<{ summary_card: unknown }>(
      `select summary_card from doctor_consultation_meta where session_id = $1 limit 1`,
      [sessionId]
    );
    return {
      status: "completed" as const,
      summaryCard: meta.rows[0]?.summary_card ?? summaryCard,
      alreadyCompleted: true,
    };
  }

  await dbQuery(
    `update doctor_consultation_meta
     set summary_card = $2::jsonb,
         ui_phase = 'closed',
         updated_at = current_timestamp
     where session_id = $1`,
    [sessionId, JSON.stringify(summaryCard)]
  );

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text)
     values ($1, 'system', $2)`,
    [sessionId, "Sesi konsultasi telah selesai. Terima kasih telah menggunakan DARSI."]
  );

  return { status: "completed" as const, summaryCard, alreadyCompleted: false };
}

export async function getMidwifeSession(sessionId: number, patientId: number) {
  const result = await dbQuery<SessionRow>(
    `select id, patient_id, session_type, status, initial_complaint
     from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const session = result.rows[0];
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.patient_id !== patientId) throw new Error("Akses ditolak");
  return session;
}

export async function getMidwifeVisibleMessages(sessionId: number, practitionerName?: string | null) {
  let practitioner = practitionerName;
  if (practitioner === undefined) {
    const meta = await dbQuery<{ doctor_name: string | null }>(
      `select doctor_name from doctor_consultation_meta where session_id = $1 limit 1`,
      [sessionId]
    );
    practitioner = meta.rows[0]?.doctor_name ?? null;
  }

  const result = await dbQuery<
    MessageRow & {
      is_takeover?: boolean | null;
    }
  >(
    `select id, sender_type, message_text, edited_text, is_takeover, staff_actor, created_at
     from chat_messages
     where session_id = $1 and hidden_at is null
     order by created_at asc, id asc`,
    [sessionId]
  );

  return result.rows.map((m) => mapMidwifeRowToVisibleMessage(m, practitioner));
}

export async function runMidwifeTriage(input: {
  sessionId: number;
  patientId: number;
  complaint: string;
}) {
  const { sessionId, patientId, complaint } = input;
  await getMidwifeSession(sessionId, patientId);

  const sessionResult = await dbQuery<SessionRow>(
    `select id, patient_id, session_type, status, initial_complaint
     from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new Error("Sesi tidak ditemukan");

  if (!session.initial_complaint && complaint) {
    await dbQuery(
      `update chat_sessions set initial_complaint = $2, updated_at = current_timestamp where id = $1`,
      [sessionId, complaint]
    );
  }

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text) values ($1, 'patient', $2)`,
    [sessionId, complaint]
  );

  const { getRsiUnits, todayIsoDate } = await import("@/src/lib/rsi-api");
  const units = await getRsiUnits("reguler");
  const today = todayIsoDate();
  const rsiSlots: import("@/src/lib/rsi-api").RsiDoctorSlot[] = [];

  // Kuota RSI hanya untuk unit keperawatan/kebidanan — bukan poli dokter anak/KIA.
  for (const unit of units) {
    if (!/kebidanan|perawat|home care|rawat jalan/i.test(`${unit.nama} ${unit.rumpun ?? ""}`)) {
      continue;
    }
    try {
      const { getRsiDoctorQuota } = await import("@/src/lib/rsi-api");
      const quota = await getRsiDoctorQuota({
        unitId: unit.id,
        tanggal: today,
        unitType: "reguler",
        unit,
      });
      rsiSlots.push(...quota.filter((d) => (d.quotaRemaining ?? 1) > 0));
    } catch {
      /* ignore */
    }
  }

  const { summary, recommendations } = recommendPractitionersFromComplaint(
    complaint,
    rsiSlots,
    units
  );
  const practitioners = recommendationsToSlots(recommendations);

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text)
     values ($1, 'agent', $2)`,
    [sessionId, `${summary}\n\nSilakan pilih bidan atau perawat yang tersedia di bawah ini.`]
  );

  await dbQuery(
    `update chat_sessions
     set status = 'triage', updated_at = current_timestamp
     where id = $1`,
    [sessionId]
  );

  await dbQuery(
    `update doctor_consultation_meta
     set triage_summary = $2,
         recommended_units = $3::jsonb,
         ui_phase = 'selecting_practitioner',
         updated_at = current_timestamp
     where session_id = $1`,
    [
      sessionId,
      summary,
      JSON.stringify(
        recommendations.map((r) => ({
          doctorCode: r.practitioner.doctorCode,
          doctorName: r.practitioner.doctorName,
          unitId: r.practitioner.unitId,
          unitName: r.practitioner.unitName,
          role: r.role,
          reason: r.reason,
        }))
      ),
    ]
  );

  return { reply: summary, practitioners };
}

export async function refreshMidwifePractitioners(sessionId: number, patientId: number) {
  const session = await getMidwifeSession(sessionId, patientId);
  const complaint = session.initial_complaint ?? "";

  const meta = await dbQuery<{ recommended_units: unknown }>(
    `select recommended_units from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );

  const stored = meta.rows[0]?.recommended_units;
  if (Array.isArray(stored) && stored.length > 0) {
    const { todayIsoDate } = await import("@/src/lib/rsi-api");
    const today = todayIsoDate();
    const mapped = stored.map((item) => {
      const row = item as {
        doctorCode: string;
        doctorName: string;
        unitId: string;
        unitName: string;
      };
      return {
        doctorCode: row.doctorCode,
        doctorName: row.doctorName,
        unitId: row.unitId,
        unitName: row.unitName,
        rumpun: "",
        unitType: "reguler" as const,
        scheduleDate: today,
        quotaRemaining: 5,
        quotaTotal: 10,
      };
    });
    const practitioners = filterMidwifePractitionerSlots(mapped);
    if (practitioners.length > 0) {
      return { practitioners, source: "cached" as const };
    }
  }

  const { getRsiUnits, todayIsoDate } = await import("@/src/lib/rsi-api");
  const units = await getRsiUnits("reguler");
  const today = todayIsoDate();
  const rsiSlots: import("@/src/lib/rsi-api").RsiDoctorSlot[] = [];

  for (const unit of units) {
    if (!/kebidanan|perawat|home care|rawat jalan/i.test(`${unit.nama} ${unit.rumpun ?? ""}`)) {
      continue;
    }
    try {
      const { getRsiDoctorQuota } = await import("@/src/lib/rsi-api");
      const quota = await getRsiDoctorQuota({
        unitId: unit.id,
        tanggal: today,
        unitType: "reguler",
        unit,
      });
      rsiSlots.push(...quota.filter((d) => (d.quotaRemaining ?? 1) > 0));
    } catch {
      /* ignore */
    }
  }

  const { recommendations } = recommendPractitionersFromComplaint(complaint, rsiSlots, units);
  const practitioners = recommendationsToSlots(recommendations);
  return { practitioners, source: "refreshed" as const };
}

export async function selectMidwifePractitioner(input: {
  sessionId: number;
  patientId: number;
  practitioner: import("@/src/lib/rsi-api").RsiDoctorSlot;
}) {
  const { sessionId, patientId, practitioner } = input;
  const session = await getMidwifeSession(sessionId, patientId);

  await dbQuery(
    `update chat_sessions set status = 'waiting_approval', updated_at = current_timestamp where id = $1`,
    [sessionId]
  );

  await dbQuery(
    `insert into doctor_consultation_meta (session_id, doctor_code, doctor_name, unit_id, unit_name, monitor_token, ui_phase)
     values ($1, $2, $3, $4, $5, $6, 'waiting')
     on conflict (session_id) do update
       set doctor_code = excluded.doctor_code, doctor_name = excluded.doctor_name,
           unit_id = excluded.unit_id, unit_name = excluded.unit_name,
           ui_phase = 'waiting'`,
    [
      sessionId,
      practitioner.doctorCode,
      practitioner.doctorName,
      practitioner.unitId,
      practitioner.unitName,
      createMonitorToken(),
    ]
  );

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text)
     values ($1, 'system', $2)`,
    [
      sessionId,
      `Anda memilih ${practitioner.doctorName} (${practitioner.unitName}). Menunggu persetujuan tenaga medis.`,
    ]
  );

  const patientResult = await dbQuery<PatientRow>(
    `select nama, no_rm from pasienkonsul.b_ms_pasien where id = $1`,
    [patientId]
  );
  const patient = patientResult.rows[0];

  const roleLabel = practitionerRoleLabel(practitioner.doctorCode);

  const telegramText = buildApprovalRequestText({
    patientName: patient?.nama ?? "-",
    patientRm: patient?.no_rm ?? "-",
    complaint: session.initial_complaint ?? "-",
    staffName: practitioner.doctorName,
    unitName: practitioner.unitName,
    roleLabel,
  });

  const telegramResult = await sendConsultationApprovalRequest(
    practitioner.doctorCode,
    sessionId,
    telegramText,
    { staffName: practitioner.doctorName }
  );

  if (!telegramResult.ok) {
    console.warn(
      "[midwife] Telegram approval tidak terkirim",
      telegramResult.error ?? "no chat id / API error"
    );
  }

  if (telegramResult.ok) {
    await dbQuery(
      `update doctor_consultation_meta
       set telegram_sent_at = current_timestamp,
           telegram_approval_messages = $2::jsonb
       where session_id = $1`,
      [sessionId, JSON.stringify(telegramResult.messageRefs ?? [])]
    );
  }

  void notifyStaffConsultationRequest({
    sessionId,
    doctorCode: practitioner.doctorCode,
    patientName: patient?.nama ?? "-",
    patientRm: patient?.no_rm ?? "-",
    complaint: session.initial_complaint ?? "-",
    doctorName: practitioner.doctorName,
    unitName: practitioner.unitName,
    roleLabel,
  }).catch((err) => console.warn("[midwife] staff notification gagal", err));

  return { status: "waiting_approval" as const, telegramSent: telegramResult.ok };
}

export async function approveMidwifeSession(
  sessionId: number,
  _actor = "Perawat",
  _greeting?: string,
  opts?: { skipOpeningAi?: boolean }
) {
  const sessionResult = await dbQuery<SessionRow>(
    `select id, patient_id, session_type, status, initial_complaint
     from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new Error("Sesi tidak ditemukan");

  await dbQuery(
    `update chat_sessions set status = 'active', updated_at = current_timestamp where id = $1`,
    [sessionId]
  );
  await setMidwifeConsultationUiPhase(sessionId, "live");

  let aiReply: ConsultationAiResponse | null = null;
  if (session.patient_id && !opts?.skipOpeningAi) {
    try {
      aiReply = await generateMidwifeLiveOpeningReply(sessionId, session.patient_id);
    } catch (error) {
      console.warn("[approveMidwifeSession] opening AI fallback", error);
    }
  } else if (session.patient_id && opts?.skipOpeningAi) {
    void generateMidwifeLiveOpeningReply(sessionId, session.patient_id).catch((error) => {
      console.warn("[approveMidwifeSession] background opening AI failed", error);
    });
  }

  return { status: "active" as const, aiReply };
}

export async function rejectMidwifeSession(sessionId: number, reason?: string, actor = "Perawat") {
  await dbQuery(
    `update chat_sessions set status = 'rejected', updated_at = current_timestamp where id = $1`,
    [sessionId]
  );
  await setMidwifeConsultationUiPhase(sessionId, "rejected");
  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text, staff_actor)
     values ($1, 'staff', $2, $3)`,
    [sessionId, reason || "Konsultasi ditolak. Silakan hubungi unit lain.", actor]
  );
  return { status: "rejected" };
}

export type PatientMidwifeSession = {
  sessionId: number;
  status: string;
  uiPhase: string;
  initialComplaint: string | null;
  practitionerName: string | null;
  lastPreview: string | null;
  messageCount: number;
  updatedAt: string;
};

export type MidwifeSessionMessage = {
  id: number;
  role: string;
  text: string;
  senderName?: string;
  createdAt: string;
};

export async function listPatientMidwifeSessions(patientId: number): Promise<PatientMidwifeSession[]> {
  const result = await dbQuery<{
    id: number;
    status: string;
    ui_phase: string | null;
    initial_complaint: string | null;
    doctor_name: string | null;
    last_message: string | null;
    msg_count: number;
    updated_at: Date;
  }>(
    `select cs.id, cs.status, coalesce(dcm.ui_phase, 'triage') as ui_phase,
            cs.initial_complaint,
            dcm.doctor_name,
            (select cm.message_text from chat_messages cm where cm.session_id = cs.id order by cm.id desc limit 1) as last_message,
            (select count(*)::int from chat_messages cm where cm.session_id = cs.id) as msg_count,
            cs.updated_at
     from chat_sessions cs
     left join doctor_consultation_meta dcm on dcm.session_id = cs.id
     where cs.patient_id = $1
       and cs.session_type in ('midwife_consultation', 'nurse_consultation')
     order by cs.updated_at desc
     limit 50`,
    [patientId]
  );

  return result.rows.map((r) => ({
    sessionId: r.id,
    status: r.status,
    uiPhase:
      r.status === "waiting_approval"
        ? "waiting"
        : r.status === "active"
          ? "live"
          : r.status === "completed"
            ? "closed"
            : r.status === "rejected"
              ? "rejected"
              : r.ui_phase ?? r.status,
    initialComplaint: r.initial_complaint,
    practitionerName: r.doctor_name,
    lastPreview: r.last_message,
    messageCount: r.msg_count,
    updatedAt: (r.updated_at ?? new Date()).toISOString(),
  }));
}

export async function getPatientMidwifeSessionView(patientId: number, sessionId: number) {
  const session = await getMidwifeSession(sessionId, patientId);

  const metaResult = await dbQuery<{
    doctor_name: string | null;
    doctor_code: string | null;
    unit_name: string | null;
    ui_phase: string | null;
    summary_card: unknown;
    recommended_units: unknown;
    prescription: unknown;
    doctor_takeover_active: boolean | null;
  }>(
    `select doctor_name, doctor_code, unit_name, ui_phase, summary_card, recommended_units, prescription,
            doctor_takeover_active
     from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  const meta = metaResult.rows[0];
  const messages = await getMidwifeVisibleMessages(sessionId, meta?.doctor_name);

  const uiPhase =
    meta?.ui_phase ??
    (session.status === "waiting_approval"
      ? "waiting"
      : session.status === "active"
        ? "live"
        : session.status === "completed"
          ? "closed"
          : session.status);

  let recommendedPractitioners: import("@/src/lib/rsi-api").RsiDoctorSlot[] = [];
  if (Array.isArray(meta?.recommended_units)) {
    const mapped = (meta.recommended_units as Array<{
      doctorCode: string;
      doctorName: string;
      unitId: string;
      unitName: string;
    }>).map((row) => ({
      doctorCode: row.doctorCode,
      doctorName: row.doctorName,
      unitId: row.unitId,
      unitName: row.unitName,
      rumpun: "",
      unitType: "reguler" as const,
      scheduleDate: "",
      quotaRemaining: 5,
      quotaTotal: 10,
    }));
    recommendedPractitioners = filterMidwifePractitionerSlots(mapped);
  }
  if (recommendedPractitioners.length === 0 && uiPhase === "selecting_practitioner") {
    recommendedPractitioners = recommendationsToSlots(
      recommendPractitionersFromComplaint(session.initial_complaint ?? "", [], []).recommendations
    );
  }

  const mappedMessages: MidwifeSessionMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    senderName: m.senderName,
    createdAt: (m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)).toISOString(),
  }));

  return {
    session: {
      id: session.id,
      status: session.status,
      sessionType: session.session_type,
      initialComplaint: session.initial_complaint,
      practitionerName: meta?.doctor_name ?? null,
      practitionerKey: meta?.doctor_code ?? null,
      unitName: meta?.unit_name ?? null,
      uiPhase,
    },
    messages: mappedMessages,
    uiPhase,
    meta: {
      doctor_name: meta?.doctor_name ?? null,
      doctor_code: meta?.doctor_code ?? null,
      unit_name: meta?.unit_name ?? null,
      summary_card: meta?.summary_card ?? null,
      ui_phase: uiPhase,
      doctor_takeover_active: meta?.doctor_takeover_active ?? false,
      prescription: (meta?.prescription as import("@/src/types/prescription").ConsultationPrescription | null) ?? null,
    },
    recommendedPractitioners,
    detail: {
      uiPhase,
      session: { status: session.status },
      meta: {
        doctor_name: meta?.doctor_name ?? null,
        unit_name: meta?.unit_name ?? null,
        ui_phase: uiPhase,
        doctor_takeover_active: meta?.doctor_takeover_active ?? false,
        summary_card: meta?.summary_card ?? null,
        prescription: (meta?.prescription as import("@/src/types/prescription").ConsultationPrescription | null) ?? null,
      },
      messages: mappedMessages,
      recommendedPractitioners,
    },
  };
}
