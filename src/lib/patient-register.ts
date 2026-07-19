import { dbQuery } from "@/src/lib/db";
import { hashPassword } from "@/src/lib/password";
import type { RegisterRequest } from "@/src/types/auth";

type PatientRow = {
  id: number;
  no_rm: string;
  nama: string | null;
};

export function normalizeNoRm(noRm: string) {
  const cleaned = noRm.trim().toUpperCase().replace(/\s+/g, "");
  const withPrefix = cleaned.match(/^RM(\d+)$/);
  if (withPrefix) {
    return `RM${withPrefix[1].padStart(3, "0")}`;
  }
  const digitsOnly = cleaned.match(/^(\d+)$/);
  if (digitsOnly) {
    return `RM${digitsOnly[1].padStart(3, "0")}`;
  }
  return cleaned;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function registerPatient(input: RegisterRequest) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const nickname = input.nickname?.trim() || null;
  const nik = input.nik?.trim() || null;
  const address = input.address.trim().slice(0, 50);
  const phone = input.phone.trim();
  const whatsapp = input.whatsapp.trim();
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const passwordHash = hashPassword(input.password);

  const emailTaken = await dbQuery<{ id: number }>(
    `select id from pasienkonsul.darsi_patient_accounts where lower(email) = $1 limit 1`,
    [email]
  );
  if (emailTaken.rows[0]) {
    throw new Error("Email sudah terdaftar. Silakan masuk dengan akun tersebut.");
  }

  const usernameTaken = await dbQuery<{ id: number }>(
    `select id from pasienkonsul.darsi_patient_accounts where lower(username) = $1 limit 1`,
    [username]
  );
  if (usernameTaken.rows[0]) {
    throw new Error("Username sudah digunakan. Pilih username lain.");
  }

  if (nik) {
    const dup = await dbQuery<{ id: number; no_rm: string }>(
      `select id, no_rm from pasienkonsul.b_ms_pasien where no_ktp = $1 limit 1`,
      [nik]
    );
    if (dup.rows[0]) {
      const existing = dup.rows[0];
      throw new Error(
        `NIK sudah terdaftar dengan No. RM ${existing.no_rm}. Hubungi admin jika belum punya akun login.`
      );
    }
  }

  const result = await dbQuery<PatientRow>(
    `insert into pasienkonsul.b_ms_pasien
       (nama, nama_panggilan, no_ktp, sex, tgl_lahir, alamat, telp, no_wa)
     values ($1, $2, $3, $4, $5::date, $6, $7, $8)
     returning id, no_rm, nama`,
    [name, nickname, nik, input.sex, input.birthDate, address, phone, whatsapp]
  );

  const patient = result.rows[0];
  if (!patient?.nama) {
    throw new Error("Gagal membuat data pasien");
  }

  try {
    await dbQuery(
      `insert into pasienkonsul.darsi_patient_accounts
         (patient_id, email, username, password_hash)
       values ($1, $2, $3, $4)`,
      [patient.id, email, username, passwordHash]
    );
  } catch (error) {
    await dbQuery(`delete from pasienkonsul.b_ms_pasien where id = $1`, [patient.id]);
    throw error;
  }

  return {
    patientId: Number(patient.id),
    noRm: patient.no_rm,
    name: patient.nama,
    email,
    username,
  };
}
