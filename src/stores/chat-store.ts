"use client";

import { create } from "zustand";
import type { AgentRole, ChatMessage, ChatPhase } from "@/src/types/chat";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import type { SessionSummaryCard } from "@/src/components/doctor/consultation-summary-card";
import type { ConsultationPrescription } from "@/src/types/prescription";

interface ChatState {
  messages: ChatMessage[];
  phase: ChatPhase;
  activeAgent: AgentRole | null;
  isStreaming: boolean;
  streamingText: string;
  consultationSessionId: number | null;
  recommendedDoctors: RsiDoctorSlot[];
  sessionSummary: SessionSummaryCard | null;
  sessionPrescription: ConsultationPrescription | null;
  selectedDoctor: RsiDoctorSlot | null;
  doctorTakeoverActive: boolean;

  setActiveAgent: (agent: AgentRole) => void;
  setPhase: (phase: ChatPhase) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamText: (text: string) => void;
  replaceStreamText: (text: string) => void;
  commitStream: () => void;
  setConsultationSessionId: (id: number | null) => void;
  setRecommendedDoctors: (doctors: RsiDoctorSlot[]) => void;
  setSessionSummary: (summary: SessionSummaryCard | null) => void;
  setSessionPrescription: (prescription: ConsultationPrescription | null) => void;
  setSelectedDoctor: (doctor: RsiDoctorSlot | null) => void;
  setDoctorTakeoverActive: (active: boolean) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  phase: "triage",
  activeAgent: null,
  isStreaming: false,
  streamingText: "",
  consultationSessionId: null,
  recommendedDoctors: [],
  sessionSummary: null,
  sessionPrescription: null,
  selectedDoctor: null,
  doctorTakeoverActive: false,

  setActiveAgent: (agent) => set({ activeAgent: agent }),

  setPhase: (phase) => set({ phase }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  appendStreamText: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),

  replaceStreamText: (text) => set({ streamingText: text }),

  commitStream: () => {
    const { streamingText, phase, messages } = get();
    if (!streamingText.trim()) {
      set({ streamingText: "", isStreaming: false });
      return;
    }

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: streamingText,
      timestamp: new Date(),
      phase,
    };

    set({
      messages: [...messages, msg],
      streamingText: "",
      isStreaming: false,
    });
  },

  setConsultationSessionId: (consultationSessionId) => set({ consultationSessionId }),

  setRecommendedDoctors: (recommendedDoctors) => set({ recommendedDoctors }),

  setSessionSummary: (sessionSummary) => set({ sessionSummary }),

  setSessionPrescription: (sessionPrescription) => set({ sessionPrescription }),

  setSelectedDoctor: (selectedDoctor) => set({ selectedDoctor }),

  setDoctorTakeoverActive: (doctorTakeoverActive) => set({ doctorTakeoverActive }),

  resetChat: () =>
    set({
      messages: [],
      phase: "triage",
      isStreaming: false,
      streamingText: "",
      consultationSessionId: null,
      recommendedDoctors: [],
      sessionSummary: null,
      sessionPrescription: null,
      selectedDoctor: null,
      doctorTakeoverActive: false,
    }),
}));
