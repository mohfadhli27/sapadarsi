export type PharmacyOrderSourceType = "uploaded_pdf" | "darsi_prescription";

export type PharmacyOrderStatus =
  | "prescription_uploaded"
  | "waiting_pharmacist_review"
  | "preparing_medicine"
  | "medicine_ready_waiting_patient_decision"
  | "delivery_requested"
  | "pickup_selected"
  | "canceled_by_patient"
  | "completed";

export type PharmacyPatientDecision = "delivery" | "pickup" | "cancel";

export type PharmacyItemAvailability =
  | "available"
  | "partial"
  | "unavailable"
  | "substitute_suggested";

export type PharmacyOrderItem = {
  id: number;
  orderId: number;
  drugName: string;
  quantity: string | null;
  unit: string | null;
  unitPrice: number;
  subtotal: number;
  availabilityStatus: PharmacyItemAvailability;
  note: string | null;
};

export type PharmacyPrescriptionOrder = {
  id: number;
  sessionId: number;
  patientId: number;
  sourceType: PharmacyOrderSourceType;
  sourceConsultationSessionId: number | null;
  prescriptionNo: string | null;
  pdfFileName: string | null;
  hasPdf: boolean;
  receiptNo: string | null;
  hasReceiptPdf: boolean;
  status: PharmacyOrderStatus;
  totalPrice: number | null;
  patientNote: string | null;
  pharmacistNote: string | null;
  patientDecision: PharmacyPatientDecision | null;
  deliveryAddress: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  readyAt: string | null;
  decidedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  items?: PharmacyOrderItem[];
  patientName?: string | null;
  patientRm?: string | null;
};

export type SavePharmacyOrderItemInput = {
  drugName: string;
  quantity?: string;
  unit?: string;
  unitPrice: number;
  availabilityStatus?: PharmacyItemAvailability;
  note?: string;
};
