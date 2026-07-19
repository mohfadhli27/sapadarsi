import type {
  ConsultationPrescription,
  PrescriptionDoctorInfo,
  PrescriptionPatientInfo,
} from "@/src/types/prescription";

export type ConsultationOutcomeNote = {
  speaker: string;
  text: string;
  at: string;
};

export type ConsultationSummaryDocument = {
  documentNo: string;
  sessionId: number;
  serviceType: "doctor_consultation" | "midwife_consultation";
  serviceLabel: string;
  providerLabel: string;
  completedAt: string;
  scheduleDate?: string | null;
  complaint: string | null;
  triageSummary: string | null;
  consultationNotes: ConsultationOutcomeNote[];
  advice?: string | null;
  patient: PrescriptionPatientInfo;
  provider: PrescriptionDoctorInfo;
  prescription?: ConsultationPrescription | null;
  verificationCode: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone: string;
  hospitalWebsite: string;
  summaryText?: string | null;
  keyFindings?: string[];
};
