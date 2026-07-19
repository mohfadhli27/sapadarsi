#!/usr/bin/env node
/** Backfill pesan pembuka LLM setelah approval (sesi yang terlewat). */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const sessionId = Number(process.argv[2]);
if (!sessionId) {
  console.error("Usage: node scripts/backfill-live-opening.mjs <sessionId>");
  process.exit(1);
}

process.env.NODE_OPTIONS = "";
for (const [k, v] of Object.entries(
  Object.fromEntries(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local"), "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  )
)) {
  process.env[k] = v;
}

const { dbQuery } = await import("../src/lib/db.ts");
const { generateDoctorLiveOpeningReply } = await import(
  "../src/lib/doctor-consultation-service.ts"
);
const { generateMidwifeLiveOpeningReply } = await import("../src/lib/consultation-service.ts");

const row = await dbQuery<{ session_type: string; patient_id: number | null }>(
  `select session_type, patient_id from chat_sessions where id = $1 limit 1`,
  [sessionId]
);
const session = row.rows[0];
if (!session?.patient_id) {
  console.error("Sesi tidak ditemukan atau tanpa patient_id");
  process.exit(1);
}

const isMidwife =
  session.session_type === "midwife_consultation" ||
  session.session_type === "nurse_consultation";

const result = isMidwife
  ? await generateMidwifeLiveOpeningReply(sessionId, session.patient_id)
  : await generateDoctorLiveOpeningReply(sessionId, session.patient_id);

console.log(result ? "OK — pesan pembuka dibuat" : "Skip — sudah ada atau tidak perlu");
