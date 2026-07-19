"use client";

import { useEffect, useRef } from "react";
import type { ChatPhase } from "@/src/types/chat";

type PatientMessageDto = {
  id: number;
  role: string;
  text: string;
  senderName?: string;
  createdAt: string;
  isTakeover?: boolean;
};

type ConsultationSseHandlers = {
  onStatus?: (data: { status: string; uiPhase: string; doctorTakeoverActive?: boolean }) => void;
  onMessages?: (messages: PatientMessageDto[]) => void;
  onPrescription?: () => void;
  onError?: (message: string) => void;
};

export function useConsultationSse(
  streamUrl: string | null,
  enabled: boolean,
  handlers: ConsultationSseHandlers
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !streamUrl) return;

    const es = new EventSource(streamUrl);

    es.addEventListener("status", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          status: string;
          uiPhase: string;
          doctorTakeoverActive?: boolean;
        };
        handlersRef.current.onStatus?.(data);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("messages", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          messages: PatientMessageDto[];
        };
        handlersRef.current.onMessages?.(data.messages);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("prescription", () => {
      handlersRef.current.onPrescription?.();
    });

    es.addEventListener("error", (ev) => {
      if ((ev as MessageEvent).data) {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { message?: string };
          handlersRef.current.onError?.(data.message ?? "Stream error");
        } catch {
          handlersRef.current.onError?.("Koneksi stream terputus");
        }
      }
    });

    es.onerror = () => {
      handlersRef.current.onError?.("Koneksi real-time terputus, mencoba ulang...");
    };

    return () => es.close();
  }, [streamUrl, enabled]);
}

export function uiPhaseToChatPhase(uiPhase: string): ChatPhase {
  const map: Record<string, ChatPhase> = {
    triage: "triage",
    selecting_doctor: "selecting_doctor",
    selecting_practitioner: "selecting_practitioner",
    waiting: "waiting",
    live: "live",
    rejected: "rejected",
    closed: "closed",
  };
  return map[uiPhase] ?? "triage";
}

export function statusToChatPhase(status: string, uiPhase?: string): ChatPhase {
  if (status === "waiting_approval") return "waiting";
  if (status === "active") return "live";
  if (status === "completed") return "closed";
  if (status === "rejected") return "rejected";
  if (uiPhase) return uiPhaseToChatPhase(uiPhase);
  return "triage";
}

export const DOCTOR_SESSION_STORAGE_KEY = "darsi-doctor-consultation-session";

export function saveActiveDoctorSession(patientId: number, sessionId: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${DOCTOR_SESSION_STORAGE_KEY}-${patientId}`, String(sessionId));
}

export function loadActiveDoctorSession(patientId: number): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${DOCTOR_SESSION_STORAGE_KEY}-${patientId}`);
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function clearActiveDoctorSession(patientId: number) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${DOCTOR_SESSION_STORAGE_KEY}-${patientId}`);
}

export const MIDWIFE_SESSION_STORAGE_KEY = "darsi-midwife-consultation-session";

export function saveActiveMidwifeSession(patientId: number, sessionId: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${MIDWIFE_SESSION_STORAGE_KEY}-${patientId}`, String(sessionId));
}

export function loadActiveMidwifeSession(patientId: number): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${MIDWIFE_SESSION_STORAGE_KEY}-${patientId}`);
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function clearActiveMidwifeSession(patientId: number) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${MIDWIFE_SESSION_STORAGE_KEY}-${patientId}`);
}
