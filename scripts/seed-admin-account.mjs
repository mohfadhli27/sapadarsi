#!/usr/bin/env node
/**
 * Seed akun admin DARSI untuk portal administrasi / CS.
 * Password: DemoPass@ChangeMe
 */
import pg from "pg";
import { randomBytes, scryptSync } from "crypto";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:PASSWORD@localhost:5432/hospital_cs";

const accounts = [
  {
    email: "admin@darsi.rsi-ayani.id",
    username: "admin",
    displayName: "Administrator DARSI",
    role: "admin",
    unitName: "IT RSI A. Yani",
    phone: null,
  },
  {
    email: "cs@darsi.rsi-ayani.id",
    username: "koordinator",
    displayName: "Koordinator CS DARSI",
    role: "coordinator",
    unitName: "Customer Service",
    phone: null,
  },
];

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const passwordHash = hashPassword("DemoPass@ChangeMe");

  for (const account of accounts) {
    await client.query(
      `insert into pasienkonsul.darsi_staff_accounts
         (email, username, password_hash, role, display_name, unit_name, phone, notify_all, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,true,true)
       on conflict (username) do update set
         email = excluded.email,
         password_hash = excluded.password_hash,
         role = excluded.role,
         display_name = excluded.display_name,
         unit_name = excluded.unit_name,
         notify_all = true,
         is_active = true`,
      [
        account.email,
        account.username,
        passwordHash,
        account.role,
        account.displayName,
        account.unitName,
        account.phone,
      ]
    );
    console.log(`OK ${account.username} (${account.role})`);
  }

  await client.end();
  console.log("\nLogin admin: https://sapadarsi.hcm-lab.id/admin/login");
  console.log("Username: admin atau koordinator");
  console.log("Password: DemoPass@ChangeMe");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
