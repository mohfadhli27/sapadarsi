"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/src/stores/chat-store";
import { useAuthStore } from "@/src/stores/auth-store";
import { getServiceTypeForRole } from "@/src/config/consultation";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import type { ChatMessage, ChatPhase } from "@/src/types/chat";
import type { SessionSummaryCard } from "@/src/components/doctor/consultation-summary-card";
import type { ConsultationPrescription } from "@/src/types/prescription";
import type {
  PatientMidwifeSession,
  MidwifeSessionMessage,
} from "@/src/lib/consultation-service";
import {
  saveActiveMidwifeSession,
  clearActiveMidwifeSession,
  loadActiveMidwifeSession,
  statusToChatPhase,
  useConsultationSse,
} from "@/src/hooks/use-consultation-sse";
import { mergeLiveSessionMessages, sseToChatMessage, type SsePatientMessage } from "@/src/lib/consultation-live-messages";

interface TriageResponse {
  reply: string;
  practitioners?: RsiDoctorSlot[];
  message?: string;
  error?: string;
  awaitingStaff?: boolean;
  staffTakeoverActive?: boolean;
}

function sessionMessageToChat(m: MidwifeSessionMessage, phase: ChatPhase): ChatMessage {
  return sseToChatMessage(
    {
      id: m.id,
      role: m.role as ChatMessage["role"],
      text: m.text,
      senderName: m.senderName,
      createdAt: m.createdAt,
    },
    phase
  );
}

function applySessionDetail(
  sessionId: number,
  detail: {
    uiPhase: string;
    session: { status: string };
    messages: Array<{
      id: number;
      role: string;
      text: string;
      senderName?: string;
      createdAt: string;
    }>;
    recommendedPractitioners: RsiDoctorSlot[];
    meta: {
      doctor_name: string | null;
      unit_name: string | null;
      summary_card?: unknown;
      ui_phase?: string;
      prescription?: ConsultationPrescription | null;
    };
  }
) {
  const phase = statusToChatPhase(detail.session.status, detail.uiPhase ?? detail.meta.ui_phase);
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
    messages: detail.messages.map((m) =>
      sessionMessageToChat(
        {
          id: m.id,
          role: m.role,
          text: m.text,
          senderName: m.senderName,
          createdAt: m.createdAt,
        },
        phase
      )
    ),
    recommendedDoctors: detail.recommendedPractitioners ?? [],
    selectedDoctor,
    sessionSummary: (detail.meta.summary_card as SessionSummaryCard) ?? null,
    sessionPrescription: detail.meta.prescription ?? null,
  });
}

export function useMidwifeConsultationChat() {
  const user = useAuthStore((s) => s.user);
  const {
    addMessage,
    setStreaming,
    consultationSessionId,
    setConsultationSessionId,
    setPhase,
    setRecommendedDoctors,
    setSelectedDoctor,
    setSessionSummary,
    setDoctorTakeoverActive,
    phase,
    resetChat,
  } = useChatStore();
  const selectedSessionIdRef = useRef<number | null>(null);
  const completingSessionRef = useRef(false);
  const resumedRef = useRef(false);
  const [isCompletingSession, setIsCompletingSession] = useState(false);

  const patientId = user?.patientId;
  const serviceType = getServiceTypeForRole("bidan");

  const streamUrl =
    patientId && consultationSessionId
      ? `/api/consultations/${consultationSessionId}/stream?patientId=${patientId}`
      : null;

  const sseEnabled =
    Boolean(consultationSessionId) &&
    (phase === "waiting" ||
      phase === "live" ||
      phase === "selecting_practitioner" ||
      phase === "closed" ||
      phase === "rejected");

  const syncPrescription = useCallback(async (sessionId: number, pid: number) => {
    try {
      const res = await fetch(
        `/api/consultations/${sessionId}/prescription?patientId=${pid}&format=json`
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

  const syncMessages = useCallback(async (sessionId: number, nextPhase: ChatPhase) => {
    const res = await fetch(`/api/consultations/${sessionId}?patientId=${patientId}`);
    const data = await res.json();
    if (!res.ok || !data.messages) return;
    useChatStore.setState({
      messages: (data.messages as Array<MidwifeSessionMessage & { content?: string }>).map((m) =>
        sessionMessageToChat(
          {
            id: m.id,
            role: m.role,
            text: m.text ?? m.content ?? "",
            senderName: m.senderName,
            createdAt: m.createdAt,
          },
          nextPhase
        )
      ),
      sessionPrescription: (data.prescription as ConsultationPrescription | null) ?? null,
    });
    if (patientId) {
      await syncPrescription(sessionId, patientId);
    }
  }, [patientId, syncPrescription]);

  const reloadSession = useCallback(
    async (sessionId: number) => {
      if (!patientId) return;
      const res = await fetch(
        `/api/consultations/threads/${sessionId}?patientId=${patientId}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) return;

      selectedSessionIdRef.current = sessionId;

      if (data.detail) {
        applySessionDetail(sessionId, {
          uiPhase: data.uiPhase ?? data.detail.uiPhase ?? data.detail.meta?.ui_phase ?? "triage",
          session: data.detail.session ?? data.session ?? { status: "triage" },
          messages: data.detail.messages ?? data.messages ?? [],
          recommendedPractitioners:
            data.detail.recommendedPractitioners ?? data.recommendedPractitioners ?? [],
          meta: {
            doctor_name: data.detail.meta?.doctor_name ?? data.meta?.doctor_name ?? null,
            unit_name: data.detail.meta?.unit_name ?? data.meta?.unit_name ?? null,
            summary_card: data.detail.meta?.summary_card ?? data.meta?.summary_card,
            ui_phase: data.detail.meta?.ui_phase,
            prescription: data.detail.meta?.prescription ?? data.meta?.prescription ?? null,
          },
        });
      } else {
        applySessionDetail(sessionId, {
          uiPhase: data.uiPhase,
          session: { status: data.session.status },
          messages: data.messages,
          recommendedPractitioners: data.recommendedPractitioners ?? [],
          meta: data.meta ?? { doctor_name: null, unit_name: null },
        });
      }
      saveActiveMidwifeSession(patientId, sessionId);
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
        messages: messages.map((m) => sseToChatMessage(m as SsePatientMessage, currentPhase)),
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

  const loadMidwifeSessions = useCallback(async (): Promise<PatientMidwifeSession[]> => {
    if (!patientId) return [];
    const res = await fetch(`/api/consultations/threads?patientId=${patientId}`);
    const data = await res.json();
    return data.sessions ?? data.threads ?? [];
  }, [patientId]);

  const openMidwifeSession = useCallback(
    async (sessionId: number) => {
      if (!patientId) return;
      setStreaming(true);
      try {
        await reloadSession(sessionId);
      } finally {
        setStreaming(false);
      }
    },
    [patientId, reloadSession, setStreaming]
  );

  const tryResumeLastSession = useCallback(async (): Promise<number | null> => {
    if (!patientId || resumedRef.current) return null;
    resumedRef.current = true;

    const savedId = loadActiveMidwifeSession(patientId);
    if (savedId) {
      try {
        await reloadSession(savedId);
        return savedId;
      } catch {
        clearActiveMidwifeSession(patientId);
      }
    }

    const sessions = await loadMidwifeSessions();
    if (sessions.length > 0) {
      const active =
        sessions.find(
          (s) =>
            s.status === "active" ||
            s.status === "waiting_approval" ||
            s.uiPhase === "live" ||
            s.uiPhase === "waiting"
        ) ?? sessions[0];
      await openMidwifeSession(active.sessionId);
      return active.sessionId;
    }

    return null;
  }, [patientId, loadMidwifeSessions, openMidwifeSession, reloadSession]);

  const startNewConsultation = useCallback(() => {
    if (patientId) clearActiveMidwifeSession(patientId);
    selectedSessionIdRef.current = null;
    resetChat();
    resumedRef.current = true;
  }, [patientId, resetChat]);

  useEffect(() => {
    resumedRef.current = false;
  }, [patientId]);

  useEffect(() => {
    if (phase !== "waiting" || !consultationSessionId || !patientId) return;

    let cancelled = false;

    async function pollOnce() {
      try {
        const res = await fetch(
          `/api/consultations/${consultationSessionId}?patientId=${patientId}`
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;

        if (data.session?.status === "active") {
          setPhase("live");
          await syncMessages(consultationSessionId!, "live");
        } else if (data.session?.status === "rejected") {
          setPhase("rejected");
          await syncMessages(consultationSessionId!, "rejected");
        }
      } catch {
        /* ignore */
      }
    }

    void pollOnce();
    const interval = setInterval(() => void pollOnce(), 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, consultationSessionId, patientId, setPhase, syncMessages]);

  // Cadangan: muat kartu resep saat live/closed (SSE sering terblokir proxy)
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

  const sendMessage = useCallback(
    async (content: string) => {
      if (!patientId || !serviceType) {
        throw new Error("Sesi pasien tidak valid");
      }

      const currentPhase = useChatStore.getState().phase;
      if (
        currentPhase === "waiting" ||
        currentPhase === "closed" ||
        currentPhase === "rejected" ||
        currentPhase === "selecting_practitioner"
      ) {
        return;
      }

      addMessage({
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        phase: currentPhase,
      });
      setStreaming(true);

      try {
        let sessionId = consultationSessionId;

        if (!sessionId) {
          const createRes = await fetch("/api/consultations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId,
              serviceType,
              initialComplaint: content,
            }),
          });
          const createData = await createRes.json();
          if (!createRes.ok || !createData.session?.id) {
            throw new Error(createData.message ?? createData.error ?? "Gagal membuat sesi");
          }
          sessionId = createData.session.id as number;
          setConsultationSessionId(sessionId);
          saveActiveMidwifeSession(patientId, sessionId);
          selectedSessionIdRef.current = sessionId;
        }

        if (currentPhase === "live" && sessionId) {
          const msgRes = await fetch(`/api/consultations/${sessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId, message: content }),
          });
          const aiResponse = (await msgRes.json()) as TriageResponse;
          if (!msgRes.ok) {
            throw new Error(aiResponse.message ?? aiResponse.error ?? "Gagal mengirim pesan");
          }
          if (aiResponse.awaitingStaff || aiResponse.staffTakeoverActive) {
            await syncMessages(sessionId, "live");
            return;
          }
          await reloadSession(sessionId);
          return;
        }

        const triageRes = await fetch(`/api/consultations/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "triage",
            patientId,
            complaint: content,
          }),
        });
        const triageData = (await triageRes.json()) as TriageResponse;
        if (!triageRes.ok) {
          throw new Error(triageData.message ?? triageData.error ?? "Gagal memproses keluhan");
        }

        setPhase("selecting_practitioner");
        setRecommendedDoctors(triageData.practitioners ?? []);
        selectedSessionIdRef.current = sessionId;
        await reloadSession(sessionId);
      } catch (error) {
        addMessage({
          id: `err-${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba lagi.",
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
      reloadSession,
      serviceType,
      setConsultationSessionId,
      setPhase,
      setRecommendedDoctors,
      setStreaming,
      syncMessages,
    ]
  );

  const sendLiveMessage = sendMessage;

  const startNewConsultationWithComplaint = useCallback(
    async (complaint: string) => {
      if (!patientId || !complaint.trim()) return;
      startNewConsultation();
      await sendMessage(complaint);
    },
    [patientId, sendMessage, startNewConsultation]
  );

  const selectPractitioner = useCallback(
    async (practitioner: RsiDoctorSlot) => {
      if (!patientId || !consultationSessionId) return;

      setSelectedDoctor(practitioner);
      setStreaming(true);

      try {
        const res = await fetch(`/api/consultations/${consultationSessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "select_practitioner",
            patientId,
            practitioner,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Gagal memilih bidan/perawat");

        setPhase("waiting");
        selectedSessionIdRef.current = consultationSessionId;
        saveActiveMidwifeSession(patientId, consultationSessionId);
        await reloadSession(consultationSessionId);
      } catch (error) {
        addMessage({
          id: `err-${Date.now()}`,
          role: "system",
          content: error instanceof Error ? error.message : "Gagal memilih bidan/perawat",
          timestamp: new Date(),
          phase: "selecting_practitioner",
        });
      } finally {
        setStreaming(false);
      }
    },
    [
      addMessage,
      consultationSessionId,
      patientId,
      reloadSession,
      setPhase,
      setSelectedDoctor,
      setStreaming,
    ]
  );

  const completeSession = useCallback(async () => {
    if (!patientId || !consultationSessionId) return;
    if (completingSessionRef.current || useChatStore.getState().phase === "closed") return;

    completingSessionRef.current = true;
    setIsCompletingSession(true);
    setStreaming(true);

    const sessionId = consultationSessionId;

    try {
      const res = await fetch(`/api/consultations/${sessionId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal menutup sesi");

      setPhase("closed");
      if (data.summaryCard) setSessionSummary(data.summaryCard as SessionSummaryCard);
      saveActiveMidwifeSession(patientId, sessionId);
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
    selectPractitioner,
    completeSession,
    isCompletingSession,
    tryResumeLastSession,
    startNewConsultation,
    startNewConsultationWithComplaint,
    loadMidwifeSessions,
    openMidwifeSession,
    loadMidwifeThreads: loadMidwifeSessions,
    openMidwifeThread: (key: string | number) =>
      openMidwifeSession(typeof key === "number" ? key : Number(key)),
  };
}
