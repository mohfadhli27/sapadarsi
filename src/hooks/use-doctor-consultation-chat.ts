"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/src/stores/chat-store";
import { useAuthStore } from "@/src/stores/auth-store";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import type { ChatMessage, ChatPhase } from "@/src/types/chat";
import type { SessionSummaryCard } from "@/src/components/doctor/consultation-summary-card";
import type { ConsultationPrescription } from "@/src/types/prescription";
import type { PatientDoctorSession } from "@/src/lib/doctor-consultation-service";
import {
  saveActiveDoctorSession,
  clearActiveDoctorSession,
  loadActiveDoctorSession,
  statusToChatPhase,
  useConsultationSse,
} from "@/src/hooks/use-consultation-sse";
import { mergeLiveSessionMessages, type SsePatientMessage } from "@/src/lib/consultation-live-messages";

interface TriageResponse {
  reply: string;
  doctors: RsiDoctorSlot[];
}

interface PatientMessageDto {
  id: number;
  role: string;
  text: string;
  senderName?: string;
  createdAt: string;
  suggestNewConsultation?: ChatMessage["suggestNewConsultation"] | boolean;
}

export type ConsultationListItem = {
  sessionId: number;
  status: string;
  uiPhase: string;
  initialComplaint: string | null;
  doctorName: string | null;
  unitName: string | null;
  createdAt: string;
  updatedAt: string;
};

function toChatMessage(m: PatientMessageDto, phase: ChatPhase): ChatMessage {
  return {
    id: `db-${m.id}`,
    role: m.role as ChatMessage["role"],
    content: m.text,
    timestamp: new Date(m.createdAt),
    phase,
    senderName: m.senderName,
    suggestNewConsultation:
      typeof m.suggestNewConsultation === "object" ? m.suggestNewConsultation : undefined,
  };
}

function applyDetailToStore(
  detail: {
    row: { status: string };
    meta: {
      doctor_name: string | null;
      unit_name: string | null;
      doctor_takeover_active?: boolean;
      ui_phase?: string;
      summary_card?: unknown;
      prescription?: ConsultationPrescription | null;
    };
    messages: PatientMessageDto[];
    recommendedDoctors?: RsiDoctorSlot[];
    summaryCard?: SessionSummaryCard | null;
  },
  sessionId: number
) {
  const phase = statusToChatPhase(detail.row.status, detail.meta.ui_phase);
  const doctors = detail.recommendedDoctors ?? [];

  let selectedDoctor: RsiDoctorSlot | null = null;
  if (detail.meta.doctor_name) {
    selectedDoctor = {
      doctorCode: "selected",
      doctorName: detail.meta.doctor_name,
      unitId: "",
      unitName: detail.meta.unit_name ?? "",
      rumpun: "",
      unitType: "reguler",
      scheduleDate: "",
    };
  }

  useChatStore.setState({
    consultationSessionId: sessionId,
    phase,
    messages: detail.messages.map((m) => toChatMessage(m, phase)),
    recommendedDoctors: doctors,
    selectedDoctor,
    sessionSummary: (detail.meta.summary_card as SessionSummaryCard) ?? null,
    sessionPrescription: detail.meta.prescription ?? null,
    doctorTakeoverActive: Boolean(detail.meta.doctor_takeover_active),
  });
}

export function useDoctorConsultationChat() {
  const user = useAuthStore((s) => s.user);
  const {
    addMessage,
    setStreaming,
    consultationSessionId,
    setConsultationSessionId,
    setPhase,
    setRecommendedDoctors,
    setSessionSummary,
    setSelectedDoctor,
    setDoctorTakeoverActive,
    phase,
    selectedDoctor,
    resetChat,
  } = useChatStore();
  const resumedRef = useRef(false);
  const selectedSessionIdRef = useRef<number | null>(null);
  const completingSessionRef = useRef(false);
  const [isCompletingSession, setIsCompletingSession] = useState(false);

  const patientId = user?.patientId;

  const streamUrl =
    patientId && consultationSessionId
      ? `/api/doctors/consultations/${consultationSessionId}/stream?patientId=${patientId}`
      : null;

  const sseEnabled =
    Boolean(consultationSessionId) &&
    (phase === "waiting" || phase === "live" || phase === "selecting_doctor" || phase === "closed");

  const syncPrescription = useCallback(async (sessionId: number, patientId: number) => {
    try {
      const res = await fetch(
        `/api/consultations/${sessionId}/prescription?patientId=${patientId}&format=json`
      );
      const data = await res.json();
      if (res.ok && data.prescription) {
        useChatStore.getState().setSessionPrescription(data.prescription);
      } else {
        useChatStore.getState().setSessionPrescription(null);
      }
    } catch {
      useChatStore.getState().setSessionPrescription(null);
    }
  }, []);

  const syncMessages = useCallback(
    async (sessionId: number, nextPhase: ChatPhase) => {
      const res = await fetch(`/api/doctors/consultations/${sessionId}/messages`);
      const data = await res.json();
      if (!res.ok || !data.messages) return;
      const synced = (data.messages as PatientMessageDto[]).map((m) =>
        toChatMessage(m, nextPhase)
      );
      useChatStore.setState({ messages: synced });
      if (patientId) {
        await syncPrescription(sessionId, patientId);
      }
    },
    [patientId, syncPrescription]
  );


  useConsultationSse(streamUrl, sseEnabled, {
    onStatus: (data) => {
      const nextPhase = statusToChatPhase(data.status, data.uiPhase);
      setPhase(nextPhase);
      setDoctorTakeoverActive(Boolean(data.doctorTakeoverActive));
      if (data.status === "completed" && useChatStore.getState().sessionSummary) {
        setPhase("closed");
      }
      if (data.status === "active" || nextPhase === "live") {
        const sid = useChatStore.getState().consultationSessionId;
        if (sid) void syncMessages(sid, "live");
      }
    },
    onMessages: (messages) => {
      const currentPhase = useChatStore.getState().phase;
      const sid = useChatStore.getState().consultationSessionId;

      if (sid && (currentPhase === "live" || currentPhase === "waiting")) {
        const current = useChatStore.getState().messages;
        useChatStore.setState({
          messages: mergeLiveSessionMessages(
            current,
            messages as SsePatientMessage[],
            currentPhase
          ),
        });
        if (patientId && messages.some((m) => /resep digital/i.test(m.text ?? ""))) {
          void syncPrescription(sid, patientId);
        }
        return;
      }

      useChatStore.setState({
        messages: messages.map((m) => toChatMessage(m, currentPhase)),
      });
      if (sid && patientId && messages.some((m) => /resep digital/i.test(m.text ?? ""))) {
        void syncPrescription(sid, patientId);
      }
    },
    onPrescription: () => {
      const sid = useChatStore.getState().consultationSessionId;
      if (sid && patientId) {
        void syncPrescription(sid, patientId);
        void syncMessages(sid, useChatStore.getState().phase);
      }
    },
  });

  const loadDoctorSessions = useCallback(async (): Promise<PatientDoctorSession[]> => {
    if (!patientId) return [];
    const res = await fetch(`/api/doctors/threads?patientId=${patientId}`);
    const data = await res.json();
    return data.sessions ?? data.threads ?? [];
  }, [patientId]);

  const loadConsultationList = useCallback(async (): Promise<ConsultationListItem[]> => {
    if (!patientId) return [];
    const res = await fetch(`/api/doctors/consultations?patientId=${patientId}`);
    const data = await res.json();
    return data.consultations ?? [];
  }, [patientId]);

  const resumeConsultation = useCallback(
    async (sessionId: number) => {
      if (!patientId) return;
      setStreaming(true);
      try {
        const res = await fetch(
          `/api/doctors/consultations/${sessionId}?patientId=${patientId}&detail=1`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Gagal memuat konsultasi");

        applyDetailToStore(data, sessionId);
        saveActiveDoctorSession(patientId, sessionId);
        selectedSessionIdRef.current = sessionId;
        await syncPrescription(sessionId, patientId);
      } finally {
        setStreaming(false);
      }
    },
    [patientId, setStreaming, syncPrescription]
  );

  const openDoctorSession = useCallback(
    async (sessionId: number) => {
      if (!patientId) return;
      selectedSessionIdRef.current = sessionId;
      await resumeConsultation(sessionId);
    },
    [patientId, resumeConsultation]
  );

  const tryResumeLastSession = useCallback(async (): Promise<number | null> => {
    if (!patientId || resumedRef.current) return null;
    resumedRef.current = true;

    const savedId = loadActiveDoctorSession(patientId);
    if (savedId) {
      try {
        await resumeConsultation(savedId);
        return savedId;
      } catch {
        clearActiveDoctorSession(patientId);
      }
    }

    const sessions = await loadDoctorSessions();
    if (sessions.length > 0) {
      const active =
        sessions.find(
          (s) =>
            s.status === "active" ||
            s.status === "waiting_approval" ||
            s.uiPhase === "live" ||
            s.uiPhase === "waiting"
        ) ?? sessions[0];
      await openDoctorSession(active.sessionId);
      return active.sessionId;
    }

    return null;
  }, [patientId, loadDoctorSessions, openDoctorSession, resumeConsultation]);

  const startNewConsultation = useCallback(() => {
    if (patientId) clearActiveDoctorSession(patientId);
    selectedSessionIdRef.current = null;
    resetChat();
    resumedRef.current = true;
  }, [patientId, resetChat]);

  useEffect(() => {
    resumedRef.current = false;
  }, [patientId]);

  // Polling cadangan — SSE sering terblokir proxy/nginx di production
  useEffect(() => {
    if (phase !== "waiting" || !consultationSessionId || !patientId) return;

    let cancelled = false;

    async function pollOnce() {
      try {
        const res = await fetch(
          `/api/doctors/consultations/${consultationSessionId}?patientId=${patientId}`
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;

        if (data.status === "active") {
          const nextPhase = statusToChatPhase(data.status, data.uiPhase);
          setPhase(nextPhase);
          await syncMessages(consultationSessionId!, nextPhase);
        } else if (data.status === "rejected") {
          setPhase("rejected");
          await syncMessages(consultationSessionId!, "rejected");
        }
      } catch {
        /* ignore transient errors */
      }
    }

    void pollOnce();
    const interval = setInterval(() => void pollOnce(), 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    phase,
    consultationSessionId,
    patientId,
    setPhase,
    syncMessages,
  ]);

  useEffect(() => {
    if (!consultationSessionId || !patientId) return;
    if (phase !== "live" && phase !== "closed") return;

    let cancelled = false;
    const loadRx = () => {
      if (!cancelled) void syncPrescription(consultationSessionId, patientId);
    };

    loadRx();
    const interval = setInterval(loadRx, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, consultationSessionId, patientId, syncPrescription]);

  const startNewConsultationWithComplaint = useCallback(
    async (complaint: string) => {
      if (!patientId || !complaint.trim()) return;
      if (patientId) clearActiveDoctorSession(patientId);
      selectedSessionIdRef.current = null;
      resetChat();
      resumedRef.current = true;

      addMessage({
        id: `msg-${Date.now()}`,
        role: "user",
        content: complaint,
        timestamp: new Date(),
        phase: "triage",
      });
      setStreaming(true);

      try {
        const createRes = await fetch("/api/doctors/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId,
            initialComplaint: complaint,
            unitType: "reguler",
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData.session?.id) {
          throw new Error(createData.message ?? "Gagal membuat sesi");
        }
        const sessionId = createData.session.id as number;
        setConsultationSessionId(sessionId);
        saveActiveDoctorSession(patientId, sessionId);

        const triageRes = await fetch(`/api/doctors/consultations/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "triage",
            patientId,
            complaint,
          }),
        });
        const triageData = (await triageRes.json()) as TriageResponse & { message?: string };
        if (!triageRes.ok) throw new Error(triageData.message ?? "Gagal memproses keluhan");

        setRecommendedDoctors(triageData.doctors ?? []);
        setPhase("selecting_doctor");
        await syncMessages(sessionId, "selecting_doctor");
        selectedSessionIdRef.current = sessionId;
      } catch (error) {
        addMessage({
          id: `err-${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Terjadi kesalahan",
          timestamp: new Date(),
          phase: "triage",
        });
      } finally {
        setStreaming(false);
      }
    },
    [
      addMessage,
      patientId,
      resetChat,
      setConsultationSessionId,
      setPhase,
      setRecommendedDoctors,
      setStreaming,
      syncMessages,
    ]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!patientId) throw new Error("Sesi pasien tidak valid");

      addMessage({
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        phase,
      });
      setStreaming(true);

      try {
        let sessionId = consultationSessionId;

        if (!sessionId) {
          const createRes = await fetch("/api/doctors/consultations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId,
              initialComplaint: content,
              unitType: "reguler",
            }),
          });
          const createData = await createRes.json();
          if (!createRes.ok || !createData.session?.id) {
            throw new Error(createData.message ?? "Gagal membuat sesi");
          }
          sessionId = createData.session.id as number;
          setConsultationSessionId(sessionId);
          saveActiveDoctorSession(patientId, sessionId);
        }

        const triageRes = await fetch(`/api/doctors/consultations/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "triage",
            patientId,
            complaint: content,
          }),
        });
        const triageData = (await triageRes.json()) as TriageResponse & { message?: string };
        if (!triageRes.ok) throw new Error(triageData.message ?? "Gagal memproses keluhan");

        setRecommendedDoctors(triageData.doctors ?? []);
        setPhase("selecting_doctor");
        await syncMessages(sessionId, "selecting_doctor");
        selectedSessionIdRef.current = sessionId;
      } catch (error) {
        addMessage({
          id: `err-${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Terjadi kesalahan",
          timestamp: new Date(),
          phase: "triage",
        });
      } finally {
        setStreaming(false);
      }
    },
    [
      addMessage,
      consultationSessionId,
      patientId,
      phase,
      setConsultationSessionId,
      setPhase,
      setRecommendedDoctors,
      setStreaming,
      syncMessages,
    ]
  );

  const selectDoctor = useCallback(
    async (doctor: RsiDoctorSlot) => {
      if (!patientId || !consultationSessionId) return;

      setSelectedDoctor(doctor);
      setStreaming(true);
      try {
        const res = await fetch(`/api/doctors/consultations/${consultationSessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "select_doctor",
            patientId,
            doctor,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Gagal memilih dokter");

        setPhase("waiting");
        selectedSessionIdRef.current = consultationSessionId;
        saveActiveDoctorSession(patientId, consultationSessionId);
        await syncMessages(consultationSessionId, "waiting");
      } catch (error) {
        addMessage({
          id: `err-${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Gagal memilih dokter",
          timestamp: new Date(),
          phase: "selecting_doctor",
        });
      } finally {
        setStreaming(false);
      }
    },
    [addMessage, consultationSessionId, patientId, setPhase, setSelectedDoctor, setStreaming, syncMessages]
  );

  const sendLiveMessage = useCallback(
    async (content: string) => {
      if (!patientId || !consultationSessionId) return;

      addMessage({
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        phase: "live",
      });
      setStreaming(true);

      try {
        const res = await fetch(
          `/api/doctors/consultations/${consultationSessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId, message: content }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Gagal mengirim pesan");

        if (data.awaitingDoctor) {
          await syncMessages(consultationSessionId, "live");
          return;
        }

        await syncMessages(consultationSessionId, "live");
      } catch (error) {
        addMessage({
          id: `err-${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Gagal mengirim pesan",
          timestamp: new Date(),
          phase: "live",
        });
      } finally {
        setStreaming(false);
      }
    },
    [addMessage, consultationSessionId, patientId, setStreaming, syncMessages]
  );

  const completeSession = useCallback(async () => {
    if (!patientId || !consultationSessionId) return;
    if (completingSessionRef.current || useChatStore.getState().phase === "closed") return;

    completingSessionRef.current = true;
    setIsCompletingSession(true);
    setStreaming(true);

    const sessionId = consultationSessionId;

    try {
      const res = await fetch(`/api/doctors/consultations/${sessionId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menutup sesi");

      setPhase("closed");
      if (data.summaryCard) setSessionSummary(data.summaryCard as SessionSummaryCard);
      saveActiveDoctorSession(patientId, sessionId);
      await syncMessages(sessionId, "closed");
    } catch (error) {
      addMessage({
        id: `err-${Date.now()}`,
        role: "system",
        content:
          error instanceof Error ? error.message : "Gagal menyelesaikan konsultasi. Silakan coba lagi.",
        timestamp: new Date(),
        phase: "live",
      });
    } finally {
      completingSessionRef.current = false;
      setIsCompletingSession(false);
      setStreaming(false);
    }
  }, [
    addMessage,
    consultationSessionId,
    patientId,
    setPhase,
    setSessionSummary,
    setStreaming,
    syncMessages,
  ]);

  return {
    sendMessage,
    sendLiveMessage,
    selectDoctor,
    completeSession,
    isCompletingSession,
    resumeConsultation,
    tryResumeLastSession,
    startNewConsultation,
    startNew: startNewConsultation,
    startNewConsultationWithComplaint,
    loadConsultationList,
    loadDoctorSessions,
    openDoctorSession,
    selectedDoctorName: selectedDoctor?.doctorName ?? null,
  };
}
