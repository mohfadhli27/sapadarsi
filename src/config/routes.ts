export const ROUTES = {
  home: "/",
  login: "/?auth=login",
  register: "/?auth=register",
  forgotPassword: "/lupa-password",
  dashboard: "/dashboard", // legacy — redirect ke home
  chat: (role: string) => `/chat/${role}`,
  profile: "/profil",
  staffLogin: "/?auth=login",
  staffDashboard: "/staff",
  staffDoctor: "/staff/dokter",
  staffMidwife: "/staff/bidan",
  staffConsultation: (sessionId: number | string) => `/staff/consultations/${sessionId}`,
  adminLogin: "/?auth=login",
  adminDashboard: "/admin",
} as const;
