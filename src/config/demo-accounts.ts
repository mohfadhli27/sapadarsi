/** Akun demo — password sama untuk semua: DemoPass@ChangeMe */
export const DEMO_PASSWORD = "DemoPass@ChangeMe";

/** Username staff demo yang tidak boleh dinonaktifkan saat sync RSI */
export const DEMO_PROTECTED_STAFF_USERNAMES = [
  "dr_demo",
  "bidan_demo",
  "bidan_siti",
  "bidan_dewi",
  "bidan_novita",
  "apoteker",
  "muh",
  "admin",
  "koordinator",
] as const;

export type DemoPatientAccount = {
  username: string;
  label: string;
  subtitle?: string;
};

export type DemoStaffAccount = {
  username: string;
  label: string;
  subtitle: string;
  kind?: "doctor" | "nurse" | "pharmacist";
};

export const DEMO_PATIENTS: DemoPatientAccount[] = [
  { username: "siti_aisyah", label: "Siti Aisyah", subtitle: "RM001" },
  { username: "ridho_dafi", label: "Ridho Dafi", subtitle: "RM002" },
  { username: "budi_santoso", label: "Budi Santoso", subtitle: "RM003" },
  { username: "dewi_lestari", label: "Dewi Lestari", subtitle: "RM004" },
  { username: "ahmad_fauzi", label: "Ahmad Fauzi", subtitle: "RM005" },
  { username: "freya_jayawardhana", label: "Freya Jayawardhana", subtitle: "RM006" },
  { username: "reva_fidela", label: "Reva Fidela", subtitle: "RM007" },
];

/** Dokter aktif RSI — username sesuai database (sync RSI), bukan label lama */
export const DEMO_DOCTORS: DemoStaffAccount[] = [
  { username: "dr_demo", label: "Dr. Demo RSI", subtitle: "Demo · semua poli", kind: "doctor" },
  { username: "dr_sheilanaliasppd", label: "dr. Sheila Nalia, Sp.PD", subtitle: "Penyakit Dalam", kind: "doctor" },
  { username: "dr_agusprabowosppd", label: "dr. Agus Prabowo, Sp.PD", subtitle: "Penyakit Dalam", kind: "doctor" },
  { username: "dr_effendisppd", label: "dr. Effendi, Sp.PD", subtitle: "Penyakit Dalam", kind: "doctor" },
  { username: "dr_fahrulabdulazissppd", label: "dr. Fahrul Abdul Azis, Sp.PD", subtitle: "Penyakit Dalam", kind: "doctor" },
  { username: "dr_bonypramonospa", label: "dr. Bony Pramono, Sp.A", subtitle: "Anak", kind: "doctor" },
  { username: "dr_vivindetrianaspa", label: "dr. Vivin Detriana, Sp.A", subtitle: "Anak", kind: "doctor" },
  { username: "dr_merysusantrispasubsptkpsk", label: "dr. Mery Susantri, Sp.A", subtitle: "Anak", kind: "doctor" },
  { username: "dr_dralphafardahathiyyahspasubspghk", label: "Dr. Alpha Fardah Athiyyah, Sp.A", subtitle: "Anak", kind: "doctor" },
  { username: "dr_rizanoviandispaksore", label: "dr. Riza Noviandi, Sp.A(K)", subtitle: "Anak (sore)", kind: "doctor" },
  { username: "dr_andiroesbiantorospthtkl", label: "dr. Andi Roesbiantoro, Sp.THT-KL", subtitle: "THT", kind: "doctor" },
  { username: "dr_andiroesbiantorospthtklsore", label: "dr. Andi Roesbiantoro, Sp.THT-KL", subtitle: "THT (sore)", kind: "doctor" },
  { username: "dr_nurlinasitioctavianispthtkl", label: "dr. Nurlina Siti Octaviani, Sp.THT-KL", subtitle: "THT", kind: "doctor" },
  { username: "dr_siskacitraamaliaspthtbkl", label: "dr. Siska Citra Amalia, Sp.THT-BKL", subtitle: "THT", kind: "doctor" },
  { username: "dr_vitapradiptyaspm", label: "dr. Vita Pradiptya, Sp.M", subtitle: "Mata", kind: "doctor" },
  { username: "dr_kiajengwindaningrumprinasetyaspm", label: "dr. Kiajeng Winda Ningrum, Sp.M", subtitle: "Mata", kind: "doctor" },
  { username: "dr_itapermatasarispmsore", label: "dr. Ita Permatasari, Sp.M", subtitle: "Mata (sore)", kind: "doctor" },
  { username: "dr_noviakusumawardhanispjp", label: "dr. Novia Kusumawardhani, Sp.JP", subtitle: "Jantung", kind: "doctor" },
  { username: "dr_fantyfilianovikaspjpk", label: "dr. Fanty Filianovika, Sp.JP (K)", subtitle: "Jantung", kind: "doctor" },
  { username: "dr_drdrandriantospjpsubspikkvkfihafasccfapscfesc", label: "Prof. Dr. dr. Andrianto, Sp.JP", subtitle: "Jantung", kind: "doctor" },
];

export const DEMO_MIDWIVES: DemoStaffAccount[] = [
  { username: "bidan_demo", label: "Bidan Demo RSI", subtitle: "Kebidanan · demo", kind: "nurse" },
  { username: "bidan_siti", label: "Bidan Siti Rahmawati, S.Keb", subtitle: "Klinik Kebidanan", kind: "nurse" },
  { username: "bidan_dewi", label: "Bidan Dewi Lestari, S.Keb", subtitle: "Poli KIA", kind: "nurse" },
  { username: "bidan_novita", label: "Bidan Novita Anggraini, S.Keb", subtitle: "Home Care", kind: "nurse" },
  { username: "muh", label: "Perawat Muhammad", subtitle: "Perawat RSI", kind: "nurse" },
];

export const DEMO_PHARMACISTS: DemoStaffAccount[] = [
  {
    username: "apoteker",
    label: "Apoteker Demo RSI",
    subtitle: "Instalasi Farmasi · demo",
    kind: "pharmacist",
  },
];

export const DEMO_ADMINS: DemoStaffAccount[] = [
  { username: "admin", label: "Administrator DARSI", subtitle: "Admin aplikasi" },
  { username: "koordinator", label: "Koordinator CS", subtitle: "Customer service" },
];

/** @deprecated gunakan DEMO_DOCTORS / DEMO_MIDWIVES */
export const DEMO_PRACTITIONERS: DemoStaffAccount[] = [...DEMO_DOCTORS, ...DEMO_MIDWIVES];

/** Sembunyikan di produksi dengan NEXT_PUBLIC_DEMO_LOGIN=false */
export function isDemoLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_LOGIN !== "false";
}
