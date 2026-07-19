export interface User {
  id: string;
  patientId: number;
  name: string;
  medicalRecordNumber: string;
  email: string;
  username: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  nickname?: string;
  nik?: string;
  sex: "L" | "P";
  birthDate: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
}
