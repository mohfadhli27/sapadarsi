#!/usr/bin/env node
/**
 * Tambah pasien demo: Freya Jayawardhana & Reva Fidela (+ akun login).
 * Password: DemoPass@ChangeMe
 *
 * Jalankan: node scripts/seed-patients-freya-reva.mjs
 */
import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes, scryptSync } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = resolve(__dirname, "../.env.local");
  try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) {
        return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* fallback */
  }
  return "postgresql://postgres:PASSWORD@localhost:5432/hospital_cs";
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const patients = [
  {
    id: 6,
    nama: "Freya Jayawardhana",
    nama_panggilan: "Freya",
    no_ktp: "3578061506980006",
    sex: "P",
    tgl_lahir: "1998-06-15",
    alamat: "Jl. Kertajaya Indah Timur No. 18, Surabaya",
    telp: "081234560006",
    no_wa: "081234560006",
    email: "freya.jayawardhana@pasien.rsi-ayani.id",
    username: "freya_jayawardhana",
  },
  {
    id: 7,
    nama: "Reva Fidela",
    nama_panggilan: "Reva",
    no_ktp: "3578062207990007",
    sex: "P",
    tgl_lahir: "1999-07-22",
    alamat: "Jl. Intirub No. 42, Surabaya",
    telp: "081234560007",
    no_wa: "081234560007",
    email: "reva.fidela@pasien.rsi-ayani.id",
    username: "reva_fidela",
  },
];

const client = new pg.Client({ connectionString: loadDatabaseUrl() });

async function upsertPatient(p) {
  await client.query(
    `INSERT INTO pasienkonsul.b_ms_pasien
       (id, nama, nama_panggilan, no_ktp, sex, tgl_lahir, alamat, telp, no_wa, kodeuser)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, 'DARSI-SEED')
     ON CONFLICT (id) DO UPDATE SET
       nama = EXCLUDED.nama,
       nama_panggilan = EXCLUDED.nama_panggilan,
       no_ktp = EXCLUDED.no_ktp,
       sex = EXCLUDED.sex,
       tgl_lahir = EXCLUDED.tgl_lahir,
       alamat = EXCLUDED.alamat,
       telp = EXCLUDED.telp,
       no_wa = EXCLUDED.no_wa`,
    [p.id, p.nama, p.nama_panggilan, p.no_ktp, p.sex, p.tgl_lahir, p.alamat, p.telp, p.no_wa]
  );

  const passwordHash = hashPassword("DemoPass@ChangeMe");
  await client.query(
    `INSERT INTO pasienkonsul.darsi_patient_accounts
       (patient_id, email, username, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (patient_id) DO UPDATE SET
       email = EXCLUDED.email,
       username = EXCLUDED.username,
       password_hash = EXCLUDED.password_hash`,
    [p.id, p.email, p.username, passwordHash]
  );

  const rm = await client.query(
    `SELECT no_rm FROM pasienkonsul.b_ms_pasien WHERE id = $1`,
    [p.id]
  );
  return rm.rows[0]?.no_rm ?? `RM${String(p.id).padStart(3, "0")}`;
}

async function main() {
  await client.connect();
  for (const p of patients) {
    const noRm = await upsertPatient(p);
    console.log(`OK ${p.username} — ${p.nama} (${noRm})`);
  }

  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('pasienkonsul.b_ms_pasien', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 1) FROM pasienkonsul.b_ms_pasien), 1)
    )
  `);

  await client.end();
  console.log("Selesai. Password login: DemoPass@ChangeMe");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
