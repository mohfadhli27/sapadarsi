#!/usr/bin/env node
/**
 * Seed akun pekerja (dokter & bidan) untuk portal staff DARSI.
 * Password semua akun: DemoPass@ChangeMe
 *
 * Jalankan: node scripts/seed-staff-accounts.mjs
 */
import pg from "pg";
import { randomBytes, scryptSync } from "crypto";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const accounts = [
  {
    email: "dokter.demo@darsi.local",
    username: "dr_demo",
    displayName: "Dr. Demo RSI",
    role: "doctor",
    doctorCode: null,
    unitName: "Semua Poli",
    phone: "082111410063",
    notifyAll: true,
  },
  {
    email: "bidan.demo@darsi.local",
    username: "bidan_demo",
    displayName: "Bidan Demo RSI",
    role: "nurse",
    doctorCode: null,
    unitName: "Kebidanan",
    phone: null,
    notifyAll: true,
  },
  {
    email: "bidan.siti@darsi.local",
    username: "bidan_siti",
    displayName: "Bidan Siti Rahmawati, S.Keb",
    role: "nurse",
    doctorCode: null,
    unitName: "Klinik Kebidanan",
    phone: null,
    notifyAll: true,
  },
  {
    email: "bidan.dewi@darsi.local",
    username: "bidan_dewi",
    displayName: "Bidan Dewi Lestari, S.Keb",
    role: "nurse",
    doctorCode: null,
    unitName: "Poli KIA",
    phone: null,
    notifyAll: true,
  },
  {
    email: "bidan.novita@darsi.local",
    username: "bidan_novita",
    displayName: "Bidan Novita Anggraini, S.Keb",
    role: "nurse",
    doctorCode: null,
    unitName: "Home Care",
    phone: null,
    notifyAll: true,
  },
  {
    email: "apoteker.demo@darsi.local",
    username: "apoteker",
    displayName: "Apoteker Demo RSI",
    role: "pharmacist",
    doctorCode: null,
    unitName: "Instalasi Farmasi",
    phone: null,
    notifyAll: false,
  },
];

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:PASSWORD@localhost:5432/hospital_cs";

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();
  const passwordHash = hashPassword("DemoPass@ChangeMe");

  for (const account of accounts) {
    await client.query(
      `insert into pasienkonsul.darsi_staff_accounts
         (email, username, password_hash, role, doctor_code, display_name, unit_name, phone, notify_all, is_active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       on conflict (username) do update set
         email = excluded.email,
         password_hash = excluded.password_hash,
         role = excluded.role,
         doctor_code = excluded.doctor_code,
         display_name = excluded.display_name,
         unit_name = excluded.unit_name,
         phone = excluded.phone,
         notify_all = excluded.notify_all,
         is_active = true`,
      [
        account.email,
        account.username,
        passwordHash,
        account.role,
        account.doctorCode,
        account.displayName,
        account.unitName,
        account.phone,
        account.notifyAll,
      ]
    );
    console.log(`OK ${account.username} (${account.displayName})`);
  }

  await client.query(
    `update pasienkonsul.darsi_staff_accounts
     set password_hash = $1, is_active = true, notify_all = true, role = 'nurse'
     where username = 'muh'`,
    [passwordHash]
  );
  console.log("OK muh (password direset ke DemoPass@ChangeMe)");

  await client.end();
  console.log("\nSelesai. Password semua akun: DemoPass@ChangeMe");
  console.log("Login via halaman utama DARSI → Masuk (/?auth=login)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
