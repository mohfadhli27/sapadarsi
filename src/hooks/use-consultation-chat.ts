"use client";

import { useCallback } from "react";
import { useChatStore } from "@/src/stores/chat-store";
import { useAuthStore } from "@/src/stores/auth-store";
import { getServiceTypeForRole } from "@/src/config/consultation";
import { midwifeStaffDisplayName } from "@/src/lib/midwife-consultation-format";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import type { AgentRole, ChatMessage } from "@/src/types/chat";

interface TriageResponse {
  reply: string;
  practitioners?: RsiDoctorSlot[];
  status?: string;
  patientReply?: string;
  awaitingStaff?: boolean;
  riskLevel?: string;
  message?: string;
  error?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollMidwifeApproval(sessionId: number, patientId: number) {
  const maxAttempts = 48;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/consultations/${sessionId}?patientId=${patientId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Gagal memuat status konsultasi");

    if (data.session?.status === "rejected") {
      throw new Error("Konsultasi ditolak perawat. Silakan mulai konsultasi baru.");
    }

    const assistant = (data.messages as Array<{ role: string; content: string; senderName?: string }>)
      ?.filter((m) => m.role === "assistant")
      .at(-1);

    if (data.session?.status === "active" && assistant?.content) {
      return assistant;
    }

    await sleep(2500);
  }
  throw new Error("Waktu tunggu persetujuan habis. Silakan refresh halaman.");
}

function formatAiReply(response: TriageResponse) {
  if (response.patientReply?.trim()) return response.patientReply;
  return response.reply;
}

export function useConsultationChat(role: AgentRole) {
  const user = useAuthStore((s) => s.user);
  const {
    addMessage,
    setStreaming,
    consultationSessionId,
    setConsultationSessionId,
    setPhase,
    setRecommendedDoctors,
    setSelectedDoctor,
  } = useChatStore();

  const serviceType = getServiceTypeForRole(role);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user?.patientId || !serviceType) {
        throw new Error("Sesi pasien tidak valid");
      }

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        phase: "triage",
      };
      addMessage(userMsg);
      setStreaming(true);

      try {
        let sessionId = consultationSessionId;

        if (!sessionId) {
          const createRes = await fetch("/api/consultations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId: user.patientId,
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
        }

        if (role === "bidan") {
          const currentPhase = useChatStore.getState().phase;

          if (currentPhase === "live" && sessionId) {
            const msgRes = await fetch(`/api/consultations/${sessionId}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                patientId: user.patientId,
                message: content,
              }),
            });
            const aiResponse = (await msgRes.json()) as TriageResponse;
            if (!msgRes.ok) {
              throw new Error(aiResponse.message ?? aiResponse.error ?? "Gagal mengirim pesan");
            }
            addMessage({
              id: `msg-${Date.now()}-ai`,
              role: "assistant",
              content: formatAiReply(aiResponse),
              timestamp: new Date(),
              phase: "live",
              senderName: midwifeStaffDisplayName(),
            });
            return;
          }

          const triageRes = await fetch(`/api/consultations/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "triage",
              patientId: user.patientId,
              complaint: content,
            }),
          });
          const triageData = (await triageRes.json()) as TriageResponse;
          if (!triageRes.ok) {
            throw new Error(triageData.message ?? triageData.error ?? "Gagal memproses keluhan");
          }

          setPhase("selecting_practitioner");
          setRecommendedDoctors(triageData.practitioners ?? []);

          const coordinatorMsg: ChatMessage = {
            id: `coord-${Date.now()}`,
            role: "coordinator",
            content: triageData.reply,
            timestamp: new Date(),
            phase: "selecting_practitioner",
            senderName: "Koordinator Bidan",
          };
          addMessage(coordinatorMsg);
          return;
        }

        const msgRes = await fetch(`/api/consultations/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: user.patientId,
            message: content,
          }),
        });

        const aiResponse = (await msgRes.json()) as TriageResponse;
        if (!msgRes.ok) {
          throw new Error(aiResponse.message ?? aiResponse.error ?? "Gagal mendapat respons AI");
        }

        setPhase("live");
        addMessage({
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: formatAiReply(aiResponse),
          timestamp: new Date(),
          phase: "live",
        });
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
      role,
      serviceType,
      setConsultationSessionId,
      setPhase,
      setRecommendedDoctors,
      setStreaming,
      user?.patientId,
    ]
  );

  const selectPractitioner = useCallback(
    async (practitioner: RsiDoctorSlot) => {
      if (!user?.patientId || !consultationSessionId) return;

      setSelectedDoctor(practitioner);
      setStreaming(true);

      try {
        const res = await fetch(`/api/consultations/${consultationSessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "select_practitioner",
            patientId: user.patientId,
            practitioner,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Gagal memilih bidan/perawat");

        setPhase("waiting");
        addMessage({
          id: `sys-${Date.now()}`,
          role: "system",
          content: `Anda memilih ${practitioner.doctorName}. Menunggu persetujuan perawat/bidan.`,
          timestamp: new Date(),
          phase: "waiting",
        });

        const approved = await pollMidwifeApproval(consultationSessionId, user.patientId);
        setPhase("live");
        addMessage({
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: approved.content,
          timestamp: new Date(),
          phase: "live",
          senderName: approved.senderName ?? midwifeStaffDisplayName(),
        });
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
      setPhase,
      setSelectedDoctor,
      setStreaming,
      user?.patientId,
    ]
  );

  return { sendMessage, selectPractitioner };
}
