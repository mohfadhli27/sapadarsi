#!/usr/bin/env node
/**
 * Seed akun pasien SIMRS — tanpa label demo di UI.
 * Password: DemoPass@ChangeMe
 */
import pg from "pg";
import { randomBytes, scryptSync } from "crypto";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const accounts = [
  { patientId: 1, email: "siti.aisyah@pasien.rsi-ayani.id", username: "siti_aisyah" },
  { patientId: 2, email: "ridho.dafi@pasien.rsi-ayani.id", username: "ridho_dafi" },
  { patientId: 3, email: "budi.santoso@pasien.rsi-ayani.id", username: "budi_santoso" },
  { patientId: 4, email: "dewi.lestari@pasien.rsi-ayani.id", username: "dewi_lestari" },
  { patientId: 5, email: "ahmad.fauzi@pasien.rsi-ayani.id", username: "ahmad_fauzi" },
  { patientId: 6, email: "freya.jayawardhana@pasien.rsi-ayani.id", username: "freya_jayawardhana" },
  { patientId: 7, email: "reva.fidela@pasien.rsi-ayani.id", username: "reva_fidela" },
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
      `insert into pasienkonsul.darsi_patient_accounts
         (patient_id, email, username, password_hash)
       values ($1, $2, $3, $4)
       on conflict (patient_id) do update set
         email = excluded.email,
         username = excluded.username,
         password_hash = excluded.password_hash`,
      [account.patientId, account.email, account.username, passwordHash]
    );
    console.log(`OK ${account.username}`);
  }

  await client.end();
  console.log("Selesai. Password: DemoPass@ChangeMe");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
