export type AgentRole = "dokter" | "bidan" | "apoteker";

export type ChatPhase =
  | "triage"
  | "selecting_doctor"
  | "selecting_practitioner"
  | "waiting"
  | "live"
  | "rejected"
  | "closed";

import type { ConsultationPrescription } from "@/src/types/prescription";
import type { PharmacyReceiptMeta } from "@/src/types/pharmacy-receipt";

export type SuggestNewConsultation = {
  complaint: string;
  label: string;
  unitHint: string;
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "doctor" | "coordinator" | "system";
  content: string;
  timestamp: Date;
  phase: ChatPhase;
  senderName?: string;
  isTakeover?: boolean;
  kind?: "message" | "session_divider" | "prescription" | "pharmacy_receipt";
  prescription?: ConsultationPrescription;
  pharmacyReceipt?: PharmacyReceiptMeta;
  sessionId?: number;
  dbMessageId?: number;
  suggestNewConsultation?: SuggestNewConsultation;
}

export interface StreamEvent {
  type: "text-delta" | "text-replace" | "status" | "phase-timing" | "tool-result" | "error";
  text?: string;
  delta?: string;
  message?: string;
  phase?: string;
}
