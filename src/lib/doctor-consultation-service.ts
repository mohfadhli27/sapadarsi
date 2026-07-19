import { randomBytes } from "crypto";
import { dbQuery } from "@/src/lib/db";
import {
  getRsiDoctorQuota,
  getRsiUnits,
  todayIsoDate,
  type RsiDoctorSlot,
  type RsiUnit,
  type RsiUnitType,
} from "@/src/lib/rsi-api";
import { recommendUnitsFromComplaint } from "@/src/lib/doctor-triage";
import type { ConsultationAiResponse } from "@/src/lib/consultation-service";
import {
  buildApprovalRequestText,
  sendConsultationApprovalRequest,
} from "@/src/lib/telegram-service";
import {
  notifyStaffConsultationRequest,
  notifyStaffPatientMessage,
} from "@/src/lib/staff-notification-service";
import { buildConsultationSummaryCard, formatScheduleDate } from "@/src/lib/consultation-completion";
import { runDoctorAgent, type DoctorAgentContext, type DoctorAgentResult } from "@/src/lib/doctor-agent";
import { runDoctorOllamaAgent } from "@/src/lib/doctor-ollama-agent";
import {
  calcPatientAge,
  extractDoctorSpecialtyLabel,
  resolvePatientHonorific,
} from "@/src/lib/patient-address";
import { resolveSessionPractitionerName } from "@/src/lib/session-practitioner";
import { currentAppPublicUrl } from "@/src/lib/session-app-origin";
import { dedupeLatestPatientTurn } from "@/src/lib/interview-context";
import { getReplyValidationIssue } from "@/src/lib/agent-reply-validator";
import { buildSoftAssessmentReply } from "@/src/lib/interview-phase";

type PatientRow = { id: number; nama: string | null; no_rm: string };
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
  edited_text: string | null;
  hidden_at: Date | null;
  is_takeover: boolean;
  created_at: Date;
};
type MetaRow = {
  session_id: number;
  unit_type: string;
  unit_id: string | null;
  unit_name: string | null;
  rumpun: string | null;
  doctor_code: string | null;
  doctor_name: string | null;
  doctor_schedule: string | null;
  doctor_quota: number | null;
  schedule_date: string | null;
  triage_summary: string | null;
  recommended_units: unknown;
  monitor_token: string;
  summary_card: unknown;
  ui_phase?: string;
  doctor_takeover_active?: boolean;
};

function resolveDoctorUiPhase(status: string, uiPhase?: string | null): string {
  if (status === "waiting_approval") return "waiting";
  if (status === "active") return "live";
  if (status === "completed") return "closed";
  if (status === "rejected") return "rejected";
  if (uiPhase && uiPhase !== "triage") return uiPhase;
  return "triage";
}

async function setDoctorConsultationUiPhase(sessionId: number, uiPhase: string) {
  await dbQuery(
    `update doctor_consultation_meta
     set ui_phase = $2, updated_at = current_timestamp
     where session_id = $1`,
    [sessionId, uiPhase]
  );
}

function createMonitorToken() {
  return randomBytes(24).toString("hex");
}

export async function createDoctorSession(input: {
  patientId: number;
  initialComplaint: string;
  unitType?: RsiUnitType;
}) {
  const patientResult = await dbQuery<PatientRow>(
    `select id, nama, no_rm from pasienkonsul.b_ms_pasien where id = $1 limit 1`,
    [input.patientId]
  );
  const patient = patientResult.rows[0];
  if (!patient?.nama) throw new Error("Pasien tidak ditemukan");

  const unitType = input.unitType ?? "reguler";
  const token = createMonitorToken();

  const sessionResult = await dbQuery<SessionRow>(
    `insert into chat_sessions (patient_id, session_type, status, initial_complaint, app_origin_url)
     values ($1, 'doctor_consultation', 'triage', $2, $3)
     returning id, patient_id, session_type, status, initial_complaint`,
    [input.patientId, input.initialComplaint, currentAppPublicUrl()]
  );
  const session = sessionResult.rows[0];

  await dbQuery(
    `insert into doctor_consultation_meta (session_id, unit_type, monitor_token)
     values ($1, $2, $3)`,
    [session.id, unitType, token]
  );

  return { session, patient, monitorToken: token };
}

export async function runDoctorTriage(input: {
  sessionId: number;
  patientId: number;
  complaint: string;
  unitType?: RsiUnitType;
}) {
  const session = await getDoctorSession(input.sessionId, input.patientId);
  const unitType = input.unitType ?? (session.meta.unit_type as RsiUnitType) ?? "reguler";

  const units = await getRsiUnits(unitType);
  const { summary, recommendations } = recommendUnitsFromComplaint(input.complaint, units);

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text)
     values ($1, 'patient', $2)`,
    [input.sessionId, input.complaint]
  );

  await dbQuery(
    `update doctor_consultation_meta
     set triage_summary = $2,
         recommended_units = $3::jsonb,
         unit_type = $4,
         updated_at = current_timestamp
     where session_id = $1`,
    [
      input.sessionId,
      summary,
      JSON.stringify(
        recommendations.map((r) => ({
          unitId: r.unit.id,
          unitName: r.unit.nama,
          rumpun: r.unit.rumpun,
          reason: r.reason,
          score: r.score,
        }))
      ),
      unitType,
    ]
  );

  const scheduleDate = todayIsoDate();
  const doctors: RsiDoctorSlot[] = [];

  for (const rec of recommendations) {
    try {
      const quota = await getRsiDoctorQuota({
        unitId: rec.unit.id,
        tanggal: scheduleDate,
        unitType,
        unit: rec.unit,
      });
      doctors.push(...quota.filter((d) => (d.quotaRemaining ?? 1) > 0));
    } catch {
      doctors.push({
        doctorCode: `demo-${rec.unit.id.slice(0, 8)}`,
        doctorName: `Dokter ${rec.unit.nama}`,
        unitId: rec.unit.id,
        unitName: rec.unit.nama,
        rumpun: rec.unit.rumpun,
        unitType,
        scheduleDate,
        quotaRemaining: 5,
        quotaTotal: 10,
      });
    }
  }

  const uniqueDoctors = new Map<string, RsiDoctorSlot>();
  for (const doc of doctors) {
    uniqueDoctors.set(`${doc.doctorCode}:${doc.unitId}`, doc);
  }
  const doctorList = [...uniqueDoctors.values()].slice(0, 12);

  const aiReply: ConsultationAiResponse = {
    reply: `${summary}\n\nSilakan pilih dokter yang tersedia di bawah ini.`,
    riskLevel: /sesak|nyeri dada|pingsan|perdarahan/i.test(input.complaint) ? "high" : "low",
    recommendation: recommendations[0]?.reason ?? "Konsultasi dokter sesuai poli",
    shouldEscalate: false,
  };

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text, tool_results)
     values ($1, 'ai', $2, $3::jsonb)`,
    [
      input.sessionId,
      aiReply.reply,
      JSON.stringify({ phase: "selecting_doctor", recommendations, doctorList }),
    ]
  );

  await dbQuery(
    `update chat_sessions set status = 'triage', updated_at = current_timestamp where id = $1`,
    [input.sessionId]
  );

  await setDoctorConsultationUiPhase(input.sessionId, "selecting_doctor");

  return { ...aiReply, recommendations, doctors: doctorList, scheduleDate };
}

export async function selectDoctor(input: {
  sessionId: number;
  patientId: number;
  doctor: RsiDoctorSlot;
}) {
  const session = await getDoctorSession(input.sessionId, input.patientId);
  if (session.row.status === "waiting_approval" || session.row.status === "active") {
    throw new Error("Dokter sudah dipilih untuk sesi ini");
  }

  await dbQuery(
    `update doctor_consultation_meta
     set unit_id = $2,
         unit_name = $3,
         rumpun = $4,
         doctor_code = $5,
         doctor_name = $6,
         doctor_schedule = $7,
         doctor_quota = $8,
         schedule_date = $9::date,
         unit_type = $10,
         updated_at = current_timestamp
     where session_id = $1`,
    [
      input.sessionId,
      input.doctor.unitId,
      input.doctor.unitName,
      input.doctor.rumpun,
      input.doctor.doctorCode,
      input.doctor.doctorName,
      input.doctor.scheduleLabel ?? null,
      input.doctor.quotaRemaining ?? null,
      input.doctor.scheduleDate,
      input.doctor.unitType,
    ]
  );

  await dbQuery(
    `update chat_sessions
     set status = 'waiting_approval',
         health_worker_type = 'doctor',
         updated_at = current_timestamp
     where id = $1`,
    [input.sessionId]
  );

  await setDoctorConsultationUiPhase(input.sessionId, "waiting");

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text)
     values ($1, 'system', $2)`,
    [
      input.sessionId,
      `Anda memilih ${input.doctor.doctorName} (${input.doctor.unitName}). Menunggu persetujuan dokter.`,
    ]
  );

  const patientResult = await dbQuery<PatientRow>(
    `select nama, no_rm from pasienkonsul.b_ms_pasien where id = $1`,
    [input.patientId]
  );
  const patient = patientResult.rows[0];

  const telegramText = buildApprovalRequestText({
    patientName: patient?.nama ?? "-",
    patientRm: patient?.no_rm ?? "-",
    complaint: session.row.initial_complaint ?? "-",
    staffName: input.doctor.doctorName,
    unitName: input.doctor.unitName,
    scheduleDate: input.doctor.scheduleDate,
    roleLabel: "Dokter",
  });

  const telegramResult = await sendConsultationApprovalRequest(
    input.doctor.doctorCode,
    input.sessionId,
    telegramText,
    { staffName: input.doctor.doctorName }
  );
  const sent = telegramResult.ok;

  if (!sent) {
    console.warn(
      "[doctor] Telegram approval tidak terkirim",
      telegramResult.error ?? "no chat id / API error"
    );
  }

  if (sent) {
    await dbQuery(
      `update doctor_consultation_meta
       set telegram_sent_at = current_timestamp,
           telegram_approval_messages = $2::jsonb
       where session_id = $1`,
      [input.sessionId, JSON.stringify(telegramResult.messageRefs ?? [])]
    );
  }

  void notifyStaffConsultationRequest({
    sessionId: input.sessionId,
    doctorCode: input.doctor.doctorCode,
    patientName: patient?.nama ?? "-",
    patientRm: patient?.no_rm ?? "-",
    complaint: session.row.initial_complaint ?? "-",
    doctorName: input.doctor.doctorName,
    unitName: input.doctor.unitName,
    roleLabel: "Dokter",
  }).catch((err) => console.warn("[doctor] staff notification gagal", err));

  return { status: "waiting_approval" as const, telegramSent: sent };
}

export async function getDoctorSession(sessionId: number, patientId?: number) {
  const sessionResult = await dbQuery<SessionRow>(
    `select id, patient_id, session_type, status, initial_complaint
     from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const row = sessionResult.rows[0];
  if (!row) throw new Error("Sesi tidak ditemukan");
  if (row.session_type !== "doctor_consultation") throw new Error("Bukan sesi konsultasi dokter");
  if (patientId && row.patient_id !== patientId) throw new Error("Sesi bukan milik pasien ini");

  const metaResult = await dbQuery<MetaRow>(
    `select * from doctor_consultation_meta where session_id = $1 limit 1`,
    [sessionId]
  );
  const meta = metaResult.rows[0];
  if (!meta) throw new Error("Metadata dokter tidak ditemukan");

  return { row, meta };
}

export async function getDoctorSessionByToken(token: string) {
  const metaResult = await dbQuery<MetaRow>(
    `select * from doctor_consultation_meta where monitor_token = $1 limit 1`,
    [token]
  );
  const meta = metaResult.rows[0];
  if (!meta) throw new Error("Sesi monitor tidak ditemukan");

  const sessionResult = await dbQuery<SessionRow>(
    `select id, patient_id, session_type, status, initial_complaint
     from chat_sessions where id = $1 limit 1`,
    [meta.session_id]
  );
  const row = sessionResult.rows[0];
  if (!row) throw new Error("Sesi tidak ditemukan");

  const patientResult = await dbQuery<PatientRow>(
    `select id, nama, no_rm from pasienkonsul.b_ms_pasien where id = $1`,
    [row.patient_id]
  );

  return { row, meta, patient: patientResult.rows[0] };
}

export async function getVisibleMessages(sessionId: number) {
  const result = await dbQuery<MessageRow & { staff_actor?: string | null }>(
    `select id, sender_type, message_text, edited_text, hidden_at, is_takeover, staff_actor, created_at
     from chat_messages
     where session_id = $1 and hidden_at is null
     order by created_at asc, id asc`,
    [sessionId]
  );
  return result.rows.map((m) => {
    const isDoctorReply =
      m.sender_type === "staff" ||
      m.sender_type === "doctor" ||
      (m.sender_type === "ai" && Boolean(m.staff_actor));
    const role =
      m.sender_type === "patient" ? "user" :
      isDoctorReply ? "doctor" :
      m.sender_type === "ai" || m.sender_type === "agent" ? "assistant" :
      "coordinator";
    return {
      id: m.id,
      role,
      senderType: m.sender_type,
      senderName: m.staff_actor ?? undefined,
      text: m.edited_text?.trim() ? m.edited_text : m.message_text,
      isTakeover: m.is_takeover,
      createdAt: m.created_at,
      suggestNewConsultation: undefined as unknown,
    };
  });
}

function resolveDoctorOpeningComplaint(
  initialComplaint: string | null | undefined,
  history: Awaited<ReturnType<typeof getVisibleMessages>>
): string {
  const fromSession = initialComplaint?.trim();
  if (fromSession) return fromSession;

  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].senderType === "patient" && history[i].text?.trim()) {
      return history[i].text.trim();
    }
  }

  return "Pasien membutuhkan konsultasi dokter.";
}

export async function generateDoctorLiveOpeningReply(sessionId: number, patientId: number) {
  const session = await getDoctorSession(sessionId, patientId);

  const existingLiveOpening = await dbQuery<{ id: number }>(
    `select id from chat_messages
     where session_id = $1
       and sender_type = 'ai'
       and coalesce(tool_results->>'liveOpening', 'false') = 'true'
     limit 1`,
    [sessionId]
  );
  if (existingLiveOpening.rows[0]) return null;

  const history = await getVisibleMessages(sessionId);
  const complaint = resolveDoctorOpeningComplaint(session.row.initial_complaint, history);
  if (!complaint) return null;

  const agentHistory = mapAgentHistory(history);
  const patient = await loadPatientProfile(patientId);
  const doctorName = session.meta.doctor_name ?? "Dokter";
  const unitName = session.meta.unit_name ?? "Poli";

  const agentResult = await runDoctorAgentWithFallback({
    phase: "greeting",
    doctorName,
    unitName,
    doctorSpecialty: extractDoctorSpecialtyLabel(unitName, doctorName),
    patientName: patient?.nama ?? undefined,
    patientHonorific: resolvePatientHonorific({
      name: patient?.nama,
      sex: patient?.sex,
      birthDate: patient?.tgl_lahir,
    }),
    patientAge: calcPatientAge(patient?.tgl_lahir),
    patientSex: patient?.sex,
    initialComplaint: session.row.initial_complaint,
    triageSummary: session.meta.triage_summary,
    history: agentHistory,
    latestMessage: complaint,
  });

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text, staff_actor, tool_results)
     values ($1, 'ai', $2, $3, $4::jsonb)`,
    [
      sessionId,
      agentResult.patientText,
      doctorName,
      JSON.stringify({
        reply: agentResult.patientText,
        riskLevel: agentResult.riskLevel,
        recommendation: agentResult.clinicalNote,
        shouldEscalate: agentResult.shouldEscalate,
        liveOpening: true,
        agentMeta: "meta" in agentResult ? agentResult.meta ?? null : null,
      }),
    ]
  );

  await dbQuery(
    `update chat_sessions set updated_at = current_timestamp where id = $1`,
    [sessionId]
  );

  return agentResult;
}

export async function approveDoctorSession(
  sessionId: number,
  _actor = "Dokter",
  opts?: { skipOpeningAi?: boolean }
) {
  const currentResult = await dbQuery<{ status: string }>(
    `select status from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const currentStatus = currentResult.rows[0]?.status;
  if (!currentStatus) throw new Error("Sesi tidak ditemukan");
  if (currentStatus === "completed" || currentStatus === "rejected") {
    throw new Error("Sesi sudah ditutup");
  }

  if (currentStatus === "waiting_approval") {
    await dbQuery(
      `update chat_sessions
       set status = 'active',
           approved_at = current_timestamp,
           updated_at = current_timestamp
       where id = $1`,
      [sessionId]
    );
  }

  await setDoctorConsultationUiPhase(sessionId, "live");
  await dbQuery(
    `update chat_sessions set updated_at = current_timestamp where id = $1`,
    [sessionId]
  );

  const sessionRow = await dbQuery<{ patient_id: number | null }>(
    `select patient_id from chat_sessions where id = $1 limit 1`,
    [sessionId]
  );
  const patientId = sessionRow.rows[0]?.patient_id;

  let aiReply: Awaited<ReturnType<typeof generateDoctorLiveOpeningReply>> | null = null;
  if (patientId && !opts?.skipOpeningAi) {
    try {
      aiReply = await generateDoctorLiveOpeningReply(sessionId, patientId);
    } catch (error) {
      console.warn("[approveDoctorSession] opening AI fallback", error);
    }
  } else if (patientId && opts?.skipOpeningAi) {
    void generateDoctorLiveOpeningReply(sessionId, patientId).catch((error) => {
      console.warn("[approveDoctorSession] background opening AI failed", error);
    });
  }

  return { status: "active" as const, aiReply };
}

export async function rejectDoctorSession(sessionId: number, reason?: string, actor = "Dokter") {
  await dbQuery(
    `update chat_sessions
     set status = 'rejected',
         rejected_at = current_timestamp,
         updated_at = current_timestamp
     where id = $1`,
    [sessionId]
  );

  await setDoctorConsultationUiPhase(sessionId, "rejected");

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text, staff_actor)
     values ($1, 'system', $2, $3)`,
    [
      sessionId,
      reason ?? "Dokter tidak dapat menerima konsultasi saat ini. Silakan pilih dokter lain.",
      actor,
    ]
  );

  return { status: "rejected" as const };
}

async function loadPatientProfile(patientId: number) {
  const result = await dbQuery<{
    nama: string | null;
    tgl_lahir: string | null;
    sex: string | null;
  }>(
    `select nama, tgl_lahir, sex from pasienkonsul.b_ms_pasien where id = $1 limit 1`,
    [patientId]
  );
  return result.rows[0] ?? null;
}

function mapAgentHistory(messages: Awaited<ReturnType<typeof getVisibleMessages>>) {
  return messages
    .filter((m) => m.senderType !== "system")
    .map((m) => {
      let role: "patient" | "doctor" | "coordinator";
      if (m.senderType === "patient") role = "patient";
      else if (
        m.senderType === "staff" ||
        m.senderType === "doctor" ||
        (m.senderType === "ai" && m.senderName)
      ) {
        role = "doctor";
      } else {
        role = "coordinator";
      }
      return { role, text: m.text };
    });
}

function resolveLiveAgentPhase(
  history: DoctorAgentContext["history"]
): DoctorAgentContext["phase"] {
  const hasDoctorReply = history?.some((m) => m.role === "doctor");
  if (!hasDoctorReply) return "greeting";
  return "consultation";
}

async function runDoctorAgentWithFallback(ctx: DoctorAgentContext): Promise<DoctorAgentResult> {
  const validationCtx = {
    latestMessage: ctx.latestMessage,
    initialComplaint: ctx.initialComplaint,
    history: ctx.history,
  };

  try {
    const result = await runDoctorAgent(ctx);
    if (!getReplyValidationIssue(result.patientText, validationCtx)) {
      return result;
    }
    console.warn("[doctor] Respons Nemotron ditolak validator, fallback Ollama");
  } catch (error) {
    console.warn("[doctor] Nemotron+MedGemma gagal, fallback Ollama lokal", error);
  }

  try {
    const fallback = await runDoctorOllamaAgent(ctx);
    if (!getReplyValidationIssue(fallback.patientText, validationCtx)) {
      return fallback;
    }
  } catch (error) {
    console.warn("[doctor] Ollama fallback gagal", error);
  }

  return {
    patientText: buildSoftAssessmentReply({
      honorific: ctx.patientHonorific,
      history: ctx.history,
      latestMessage: ctx.latestMessage,
      initialComplaint: ctx.initialComplaint,
    }),
    riskLevel: "low",
    clinicalNote: "",
    shouldEscalate: false,
    meta: {
      orchestratorProfile: "soft-assessment",
      orchestratorModel: "n/a",
      medgemmaModel: "n/a",
      stack: "soft-assessment-fallback",
    },
  };
}

export async function sendDoctorChatMessage(input: {
  sessionId: number;
  patientId: number;
  message: string;
}) {
  const session = await getDoctorSession(input.sessionId, input.patientId);
  if (session.row.status === "waiting_approval") {
    throw new Error("Menunggu persetujuan dokter sebelum chat dimulai");
  }
  if (session.row.status !== "active" && session.row.status !== "triage") {
    throw new Error("Sesi tidak aktif");
  }

  if (session.meta.doctor_takeover_active) {
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
      doctorTakeoverActive: true,
      awaitingDoctor: true,
    };
  }

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text)
     values ($1, 'patient', $2)`,
    [input.sessionId, input.message]
  );

  void notifyStaffPatientMessage({
    sessionId: input.sessionId,
    doctorCode: session.meta.doctor_code,
    patientName: "Pasien",
    messagePreview: input.message,
  }).catch((err) => console.warn("[doctor] notif pesan pasien gagal", err));

  const history = await getVisibleMessages(input.sessionId);
  let agentHistory = mapAgentHistory(history);
  agentHistory = dedupeLatestPatientTurn(agentHistory, input.message);

  const patient = await loadPatientProfile(input.patientId);
  const doctorName = session.meta.doctor_name ?? "Dokter";
  const unitName = session.meta.unit_name ?? "Poli";

  const agentResult = await runDoctorAgentWithFallback({
    phase: resolveLiveAgentPhase(agentHistory),
    doctorName,
    unitName,
    doctorSpecialty: extractDoctorSpecialtyLabel(unitName, doctorName),
    patientName: patient?.nama ?? undefined,
    patientHonorific: resolvePatientHonorific({
      name: patient?.nama,
      sex: patient?.sex,
      birthDate: patient?.tgl_lahir,
    }),
    patientAge: calcPatientAge(patient?.tgl_lahir),
    patientSex: patient?.sex,
    initialComplaint: session.row.initial_complaint,
    triageSummary: session.meta.triage_summary,
    history: agentHistory,
    latestMessage: input.message,
  });

  const aiResponse: ConsultationAiResponse = {
    reply: agentResult.patientText,
    riskLevel: agentResult.riskLevel,
    recommendation: agentResult.clinicalNote,
    shouldEscalate: agentResult.shouldEscalate,
  };

  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text, staff_actor, tool_results)
     values ($1, 'ai', $2, $3, $4::jsonb)`,
    [
      input.sessionId,
      aiResponse.reply,
      doctorName,
      JSON.stringify({
        ...aiResponse,
        agentMeta: "meta" in agentResult ? agentResult.meta ?? null : null,
      }),
    ]
  );

  if (session.row.status === "triage") {
    await dbQuery(`update chat_sessions set status = 'active' where id = $1`, [input.sessionId]);
  }

  return {
    ...aiResponse,
    doctorTakeoverActive: false,
    awaitingDoctor: false,
  };
}

export async function staffEditMessage(input: {
  messageId: number;
  editedText: string;
  actor: string;
}) {
  const editedText = input.editedText.trim();
  if (!editedText) throw new Error("Pesan edit tidak boleh kosong");

  const sessionResult = await dbQuery<{ session_id: number }>(
    `select session_id from chat_messages where id = $1 limit 1`,
    [input.messageId]
  );
  const sessionId = sessionResult.rows[0]?.session_id;
  const patientFacingActor = sessionId
    ? await resolveSessionPractitionerName(sessionId, input.actor)
    : input.actor;

  await dbQuery(
    `update chat_messages
     set edited_text = $2, staff_actor = $3
     where id = $1`,
    [input.messageId, editedText, patientFacingActor]
  );
  await dbQuery(
    `update chat_sessions
     set updated_at = current_timestamp
     where id = (select session_id from chat_messages where id = $1 limit 1)`,
    [input.messageId]
  );
}

export async function staffHideMessage(messageId: number, actor: string) {
  await dbQuery(
    `update chat_messages
     set hidden_at = current_timestamp, staff_actor = $2
     where id = $1`,
    [messageId, actor]
  );
  await dbQuery(
    `update chat_sessions
     set updated_at = current_timestamp
     where id = (select session_id from chat_messages where id = $1 limit 1)`,
    [messageId]
  );
}

export async function staffTakeoverMessage(input: {
  sessionId: number;
  message: string;
  actor: string;
}) {
  const message = input.message.trim();
  if (!message) throw new Error("Pesan tidak boleh kosong");

  const patientFacingActor = await resolveSessionPractitionerName(input.sessionId, input.actor);

  await setDoctorTakeoverMode(input.sessionId, true);
  await dbQuery(
    `insert into chat_messages (session_id, sender_type, message_text, staff_actor, is_takeover)
     values ($1, 'staff', $2, $3, true)`,
    [input.sessionId, message, patientFacingActor]
  );
  await dbQuery(
    `update chat_sessions set updated_at = current_timestamp where id = $1`,
    [input.sessionId]
  );
}

export async function completeDoctorSession(sessionId: number, patientId: number) {
  const session = await getDoctorSession(sessionId, patientId);

  if (session.row.status === "completed") {
    return {
      status: "completed" as const,
      summaryCard: session.meta.summary_card ?? null,
      alreadyCompleted: true,
    };
  }

  if (session.row.status === "rejected") {
    throw new Error("Sesi konsultasi sudah ditolak");
  }

  const summaryCard = await buildConsultationSummaryCard(sessionId, "doctor_consultation").catch(
    (error) => {
      console.warn("[completeDoctorSession] summary card fallback", error);
      return {
        completedAt: new Date().toISOString(),
        advice:
          "Istirahat cukup, minum air putih, dan ikuti anjuran dokter. Segera ke IGD jika gejala memburuk.",
        summaryText: "Pasien menyelesaikan sesi konsultasi dokter melalui DARSI.",
        keyFindings: [] as string[],
        doctorName: session.meta.doctor_name,
        unitName: session.meta.unit_name,
        scheduleDate: formatScheduleDate(session.meta.schedule_date),
        complaint: session.row.initial_complaint,
      };
    }
  );

  const updated = await dbQuery<{ id: number }>(
    `update chat_sessions
     set status = 'completed',
         completed_at = current_timestamp,
         closed_at = current_timestamp,
         updated_at = current_timestamp
     where id = $1 and status not in ('completed', 'rejected')
     returning id`,
    [sessionId]
  );

  if (!updated.rows[0]) {
    const latest = await getDoctorSession(sessionId, patientId);
    return {
      status: "completed" as const,
      summaryCard: latest.meta.summary_card ?? summaryCard,
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

export async function pollSessionStatus(sessionId: number, patientId: number) {
  const session = await getDoctorSession(sessionId, patientId);
  return {
    status: session.row.status,
    uiPhase: resolveDoctorUiPhase(session.row.status, session.meta.ui_phase),
    doctorName: session.meta.doctor_name,
    unitName: session.meta.unit_name,
    summaryCard: session.meta.summary_card,
  };
}

export async function listDoctorsForUnit(input: {
  unitId: string;
  unitName?: string;
  unitType?: RsiUnitType;
  tanggal?: string;
}) {
  const units = await getRsiUnits(input.unitType ?? "reguler");
  const unit = units.find((u) => u.id === input.unitId || u.nama === input.unitName);
  if (!unit) throw new Error("Poli tidak ditemukan");

  const tanggal = input.tanggal ?? todayIsoDate();
  try {
    const doctors = await getRsiDoctorQuota({
      unitId: input.unitId,
      tanggal,
      unitType: input.unitType ?? "reguler",
      unit,
    });
    return { doctors, source: "rsi" as const };
  } catch {
    return {
      doctors: [
        {
          doctorCode: `demo-${unit.id.slice(0, 8)}`,
          doctorName: `Dokter ${unit.nama}`,
          unitId: unit.id,
          unitName: unit.nama,
          rumpun: unit.rumpun,
          unitType: input.unitType ?? "reguler",
          scheduleDate: tanggal,
          quotaRemaining: 5,
          quotaTotal: 10,
        } satisfies RsiDoctorSlot,
      ],
      source: "fallback" as const,
    };
  }
}

export type ConsultationListItem = {
  sessionId: number;
  patientId: number;
  patientName: string | null;
  noRm: string | null;
  patientRm: string | null;
  status: string;
  uiPhase: string | null;
  initialComplaint: string | null;
  doctorCode: string | null;
  doctorName: string | null;
  unitName: string | null;
  monitorToken: string | null;
  messageCount: number;
  lastMessage: string | null;
  updatedAt: string;
  createdAt: string;
  sessionType?: string;
};

export async function listPatientDoctorConsultations(patientId: number): Promise<ConsultationListItem[]> {
  const result = await dbQuery<{
    id: number; patient_id: number; status: string; ui_phase: string | null;
    initial_complaint: string | null; updated_at: Date; created_at: Date;
    doctor_code: string | null; doctor_name: string | null; unit_name: string | null;
    monitor_token: string | null; msg_count: number; last_message: string | null;
    patient_name: string | null; no_rm: string | null;
  }>(
    `select cs.id, cs.patient_id, cs.status, coalesce(dcm.ui_phase, 'triage') as ui_phase, cs.initial_complaint, cs.updated_at, cs.created_at,
            dcm.doctor_code, dcm.doctor_name, dcm.unit_name, dcm.monitor_token,
            (select count(*)::int from chat_messages cm where cm.session_id = cs.id) as msg_count,
            (select cm.message_text from chat_messages cm where cm.session_id = cs.id order by cm.id desc limit 1) as last_message,
            p.nama as patient_name, p.no_rm
     from chat_sessions cs
     left join doctor_consultation_meta dcm on dcm.session_id = cs.id
     left join pasienkonsul.b_ms_pasien p on p.id = cs.patient_id
     where cs.patient_id = $1
       and cs.session_type = 'doctor_consultation'
     order by cs.updated_at desc
     limit 50`,
    [patientId]
  );

  return result.rows.map((r) => ({
    sessionId: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    noRm: r.no_rm,
    patientRm: r.no_rm,
    status: r.status,
    uiPhase: r.ui_phase,
    initialComplaint: r.initial_complaint,
    doctorCode: r.doctor_code,
    doctorName: r.doctor_name,
    unitName: r.unit_name,
    monitorToken: r.monitor_token,
    messageCount: r.msg_count,
    lastMessage: r.last_message,
    updatedAt: (r.updated_at ?? new Date()).toISOString(),
    createdAt: (r.created_at ?? new Date()).toISOString(),
  }));
}

export type PatientDoctorSession = {
  sessionId: number;
  status: string;
  uiPhase: string;
  initialComplaint: string | null;
  doctorName: string | null;
  doctorCode: string | null;
  unitName: string | null;
  lastPreview: string | null;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
};

function resolveSessionUiPhase(status: string, uiPhase?: string | null): string {
  if (status === "waiting_approval") return "waiting";
  if (status === "active") return "live";
  if (status === "completed") return "closed";
  if (status === "rejected") return "rejected";
  return uiPhase ?? "triage";
}

export async function listPatientDoctorSessions(patientId: number): Promise<PatientDoctorSession[]> {
  const result = await dbQuery<{
    id: number;
    status: string;
    ui_phase: string | null;
    initial_complaint: string | null;
    doctor_name: string | null;
    doctor_code: string | null;
    unit_name: string | null;
    last_message: string | null;
    msg_count: number;
    updated_at: Date;
    created_at: Date;
  }>(
    `select cs.id, cs.status, cs.initial_complaint, cs.updated_at, cs.created_at,
            coalesce(dcm.ui_phase, 'triage') as ui_phase,
            dcm.doctor_name, dcm.doctor_code, dcm.unit_name,
            (
              select coalesce(cm.edited_text, cm.message_text)
              from chat_messages cm
              where cm.session_id = cs.id and cm.hidden_at is null
              order by cm.created_at desc, cm.id desc
              limit 1
            ) as last_message,
            (select count(*)::int from chat_messages cm where cm.session_id = cs.id) as msg_count
     from chat_sessions cs
     join doctor_consultation_meta dcm on dcm.session_id = cs.id
     where cs.patient_id = $1 and cs.session_type = 'doctor_consultation'
     order by cs.updated_at desc
     limit 50`,
    [patientId]
  );

  return result.rows.map((row) => ({
    sessionId: row.id,
    status: row.status,
    uiPhase: resolveSessionUiPhase(row.status, row.ui_phase),
    initialComplaint: row.initial_complaint,
    doctorName: row.doctor_name,
    doctorCode: row.doctor_code,
    unitName: row.unit_name,
    lastPreview: row.last_message,
    messageCount: row.msg_count,
    updatedAt: (row.updated_at ?? new Date()).toISOString(),
    createdAt: (row.created_at ?? new Date()).toISOString(),
  }));
}

/** @deprecated Use listPatientDoctorSessions */
export const listPatientDoctorThreads = listPatientDoctorSessions;

type StaffListFilter = {
  id: number;
  role: string;
  doctorCode: string | null;
  notifyAll: boolean;
};

function mapConsultationListRow(r: {
  id: number;
  patient_id: number;
  status: string;
  ui_phase: string | null;
  initial_complaint: string | null;
  updated_at: Date;
  created_at: Date;
  doctor_code: string | null;
  doctor_name: string | null;
  unit_name: string | null;
  monitor_token: string | null;
  msg_count: number;
  last_message: string | null;
  patient_name: string | null;
  no_rm: string | null;
  session_type: string;
}): ConsultationListItem {
  return {
    sessionId: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    noRm: r.no_rm,
    patientRm: r.no_rm,
    status: r.status,
    uiPhase: r.ui_phase,
    initialComplaint: r.initial_complaint,
    doctorCode: r.doctor_code,
    doctorName: r.doctor_name,
    unitName: r.unit_name,
    monitorToken: r.monitor_token,
    messageCount: r.msg_count,
    lastMessage: r.last_message,
    updatedAt: (r.updated_at ?? new Date()).toISOString(),
    createdAt: (r.created_at ?? new Date()).toISOString(),
    sessionType: r.session_type,
  };
}

export async function listStaffDoctorConsultations(
  filter?: string | StaffListFilter | { staffId?: number; doctorCode?: string }
): Promise<ConsultationListItem[]> {
  if (typeof filter === "object" && filter && "role" in filter) {
    return listStaffConsultations(filter);
  }

  const staffDoctorCode = typeof filter === "string" ? filter : filter?.doctorCode;
  const whereClause = staffDoctorCode ? `and dcm.doctor_code = $1` : "";
  const params = staffDoctorCode ? [staffDoctorCode] : [];

  const result = await dbQuery<Parameters<typeof mapConsultationListRow>[0]>(
    `select cs.id, cs.patient_id, cs.status, cs.session_type,
            coalesce(dcm.ui_phase, 'triage') as ui_phase, cs.initial_complaint, cs.updated_at, cs.created_at,
            dcm.doctor_code, dcm.doctor_name, dcm.unit_name, dcm.monitor_token,
            (select count(*)::int from chat_messages cm where cm.session_id = cs.id) as msg_count,
            (select cm.message_text from chat_messages cm where cm.session_id = cs.id order by cm.id desc limit 1) as last_message,
            p.nama as patient_name, p.no_rm
     from chat_sessions cs
     left join doctor_consultation_meta dcm on dcm.session_id = cs.id
     left join pasienkonsul.b_ms_pasien p on p.id = cs.patient_id
     where cs.session_type = 'doctor_consultation' ${whereClause}
     order by cs.updated_at desc
     limit 100`,
    params
  );

  return result.rows.map(mapConsultationListRow);
}

export async function listStaffConsultations(staff: StaffListFilter): Promise<ConsultationListItem[]> {
  if (staff.role === "nurse") {
    const result = await dbQuery<Parameters<typeof mapConsultationListRow>[0]>(
      `select cs.id, cs.patient_id, cs.status, cs.session_type,
              coalesce(dcm.ui_phase, 'triage') as ui_phase, cs.initial_complaint, cs.updated_at, cs.created_at,
              dcm.doctor_code, dcm.doctor_name, dcm.unit_name, dcm.monitor_token,
              (select count(*)::int from chat_messages cm where cm.session_id = cs.id) as msg_count,
              (select cm.message_text from chat_messages cm where cm.session_id = cs.id order by cm.id desc limit 1) as last_message,
              p.nama as patient_name, p.no_rm
       from chat_sessions cs
       left join doctor_consultation_meta dcm on dcm.session_id = cs.id
       left join pasienkonsul.b_ms_pasien p on p.id = cs.patient_id
       where cs.session_type in ('midwife_consultation', 'nurse_consultation')
         and (
           dcm.assigned_staff_id = $1
           or ($2::boolean = true)
           or dcm.assigned_staff_id is null
         )
       order by cs.updated_at desc
       limit 100`,
      [staff.id, staff.notifyAll]
    );
    return result.rows.map(mapConsultationListRow);
  }

  const result = await dbQuery<Parameters<typeof mapConsultationListRow>[0]>(
    `select cs.id, cs.patient_id, cs.status, cs.session_type,
            coalesce(dcm.ui_phase, 'triage') as ui_phase, cs.initial_complaint, cs.updated_at, cs.created_at,
            dcm.doctor_code, dcm.doctor_name, dcm.unit_name, dcm.monitor_token,
            (select count(*)::int from chat_messages cm where cm.session_id = cs.id) as msg_count,
            (select cm.message_text from chat_messages cm where cm.session_id = cs.id order by cm.id desc limit 1) as last_message,
            p.nama as patient_name, p.no_rm
     from chat_sessions cs
     left join doctor_consultation_meta dcm on dcm.session_id = cs.id
     left join pasienkonsul.b_ms_pasien p on p.id = cs.patient_id
     where cs.session_type = 'doctor_consultation'
       and (
         dcm.assigned_staff_id = $1
         or ($2::boolean = true)
         or ($3::text is not null and dcm.doctor_code = $3)
       )
     order by cs.updated_at desc
     limit 100`,
    [staff.id, staff.notifyAll, staff.doctorCode]
  );

  return result.rows.map(mapConsultationListRow);
}

export async function getDoctorConsultationDetail(sessionId: number, patientId: number) {
  const session = await getDoctorSession(sessionId, patientId);
  const messages = await getVisibleMessages(sessionId);
  return { ...session, messages };
}

export async function getConsultationEventSnapshot(sessionId: number) {
  const result = await dbQuery<{
    status: string;
    ui_phase: string | null;
    doctor_takeover_active: boolean | null;
    updated_at: Date;
    prescription: unknown;
  }>(
    `select cs.status, dcm.ui_phase, dcm.doctor_takeover_active, cs.updated_at, dcm.prescription
     from chat_sessions cs
     left join doctor_consultation_meta dcm on dcm.session_id = cs.id
     where cs.id = $1 limit 1`,
    [sessionId]
  );
  const row = result.rows[0];
  if (!row) return null;

  const msgResult = await dbQuery<{ messages_hash: string | null }>(
    `select md5(coalesce(string_agg(
      m.id::text || ':' ||
      coalesce(nullif(trim(m.edited_text), ''), m.message_text, '') || ':' ||
      coalesce(m.staff_actor, '') || ':' ||
      coalesce(m.is_takeover::text, 'false'),
      '|' order by m.id
    ), '')) as messages_hash
    from chat_messages m
    where m.session_id = $1 and m.hidden_at is null`,
    [sessionId]
  );
  const messagesHash = msgResult.rows[0]?.messages_hash ?? "0";
  const prescriptionHash = row.prescription
    ? `${JSON.stringify(row.prescription).length}`
    : "0";

  return {
    status: row.status,
    uiPhase: resolveDoctorUiPhase(row.status, row.ui_phase),
    doctorTakeoverActive: row.doctor_takeover_active ?? false,
    updatedAt: (row.updated_at ?? new Date()).toISOString(),
    messagesHash,
    prescriptionHash,
  };
}

export async function refreshSessionDoctors(sessionId: number, patientId: number) {
  const session = await getDoctorSession(sessionId, patientId);
  const unitId = session.meta.unit_id;
  if (!unitId) return { doctors: [] };

  const { doctors } = await listDoctorsForUnit({ unitId });
  return { doctors };
}

export async function setDoctorTakeoverMode(sessionId: number, active: boolean) {
  await dbQuery(
    `update doctor_consultation_meta
     set doctor_takeover_active = $2, updated_at = current_timestamp
     where session_id = $1`,
    [sessionId, active]
  );
  if (active) {
    await setDoctorConsultationUiPhase(sessionId, "live");
  }
  await dbQuery(
    `update chat_sessions set updated_at = current_timestamp where id = $1`,
    [sessionId]
  );
  return { doctorTakeoverActive: active };
}

export type { RsiDoctorSlot, RsiUnit };
