export type PrescriptionMedication = {
  name: string;
  strength?: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity?: string;
  notes?: string;
};

export type ConsultationPrescription = {
  prescriptionNo: string;
  sessionId: number;
  diagnosis: string;
  icd10?: string;
  medications: PrescriptionMedication[];
  generalAdvice?: string;
  followUp?: string;
  patientWeight?: string;
  validUntil: string;
  doctorSip?: string;
  issuedAt: string;
  issuedBy: string;
  verificationCode: string;
  status: "issued";
};

export type PrescriptionPatientInfo = {
  name: string;
  medicalRecordNumber: string;
  birthDate?: string | null;
  sex?: string | null;
  address?: string | null;
  age?: string | null;
};

export type PrescriptionDoctorInfo = {
  name: string;
  unitName?: string | null;
  sip?: string | null;
};

export type PrescriptionDocumentData = {
  prescription: ConsultationPrescription;
  patient: PrescriptionPatientInfo;
  doctor: PrescriptionDoctorInfo;
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone: string;
  hospitalWebsite: string;
};

export type SavePrescriptionInput = {
  diagnosis: string;
  icd10?: string;
  medications: PrescriptionMedication[];
  generalAdvice?: string;
  followUp?: string;
  patientWeight?: string;
  validUntil: string;
  doctorSip?: string;
};
