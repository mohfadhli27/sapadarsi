export type StaffRole = "doctor" | "coordinator" | "admin" | "nurse" | "pharmacist";

export type StaffUser = {
  id: number;
  email: string;
  username: string;
  role: StaffRole;
  doctorCode: string | null;
  displayName: string;
  unitName: string | null;
  phone: string | null;
  notifyAll: boolean;
};

export type StaffNotification = {
  id: number;
  sessionId: number;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
};

export type StaffLoginResponse = {
  success: boolean;
  message?: string;
  staff?: StaffUser;
  sessionToken?: string;
};
