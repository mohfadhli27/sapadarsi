#!/usr/bin/env node
/**
 * Smoke test alur pharmacy prescription order (API level).
 * Jalankan: node scripts/test-pharmacy-prescription-order.mjs
 */
import pg from "pg";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DARSI_BASE_URL || "http://localhost:3030";
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:PASSWORD@localhost:5432/hospital_cs";

const client = new pg.Client({ connectionString });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function staffLogin(username) {
  const res = await fetch(`${BASE}/api/staff/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password: "DemoPass@ChangeMe" }),
  });
  const data = await res.json();
  assert(data.success && data.sessionToken, `Login ${username} gagal`);
  return data.sessionToken;
}

async function main() {
  await client.connect();

  const { rows: patients } = await client.query(
    `SELECT id FROM pasienkonsul.b_ms_pasien ORDER BY id LIMIT 1`
  );
  const patientId = patients[0]?.id;
  assert(patientId, "Tidak ada pasien di DB");

  const { rows: sessions } = await client.query(
    `INSERT INTO chat_sessions (patient_id, session_type, status)
     VALUES ($1, 'pharmacist_consultation', 'active')
     RETURNING id`,
    [patientId]
  );
  const sessionId = sessions[0].id;

  const pdfPath = join(__dirname, "fixtures/sample-prescription.pdf");
  let pdfBuffer;
  try {
    pdfBuffer = readFileSync(pdfPath);
  } catch {
    pdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
  }

  const form = new FormData();
  form.append("patientId", String(patientId));
  form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), "resep-test.pdf");

  const uploadRes = await fetch(
    `${BASE}/api/pharmacy/sessions/${sessionId}/prescription-orders`,
    { method: "POST", body: form }
  );
  const uploadData = await uploadRes.json();
  assert(uploadData.success, uploadData.message ?? "Upload gagal");
  const orderId = uploadData.order.id;
  console.log("OK upload PDF → order", orderId);

  const badForm = new FormData();
  badForm.append("patientId", String(patientId));
  badForm.append("file", new Blob(["not pdf"], { type: "text/plain" }), "bad.txt");
  const badRes = await fetch(
    `${BASE}/api/pharmacy/sessions/${sessionId}/prescription-orders`,
    { method: "POST", body: badForm }
  );
  const badData = await badRes.json();
  assert(!badData.success, "Non-PDF seharusnya ditolak");
  console.log("OK non-PDF ditolak");

  const pharmacistToken = await staffLogin("apoteker");
  const staffHeaders = { Authorization: `Bearer ${pharmacistToken}`, "Content-Type": "application/json" };

  await fetch(`${BASE}/api/staff/pharmacy-orders/${orderId}`, {
    method: "PATCH",
    headers: staffHeaders,
    body: JSON.stringify({ action: "start_review" }),
  });

  await fetch(`${BASE}/api/staff/pharmacy-orders/${orderId}`, {
    method: "PATCH",
    headers: staffHeaders,
    body: JSON.stringify({
      items: [{ drugName: "Paracetamol 500mg", quantity: "10", unit: "tablet", unitPrice: 5000 }],
      pharmacistNote: "Test",
    }),
  });

  const readyRes = await fetch(`${BASE}/api/staff/pharmacy-orders/${orderId}/confirm-ready`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pharmacistToken}` },
  });
  const readyData = await readyRes.json();
  assert(readyData.success, readyData.message ?? "Confirm ready gagal");
  console.log("OK apoteker konfirmasi obat siap");

  const decisionRes = await fetch(
    `${BASE}/api/pharmacy/sessions/${sessionId}/prescription-orders/${orderId}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, decision: "pickup" }),
    }
  );
  const decisionData = await decisionRes.json();
  assert(decisionData.success, decisionData.message ?? "Decision gagal");
  assert(decisionData.order.status === "pickup_selected", "Status pickup_selected");
  console.log("OK pasien pilih pickup");

  const doctorToken = await staffLogin("dr_demo");
  const denied = await fetch(`${BASE}/api/staff/pharmacy-orders`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  });
  assert(denied.status === 401, "Dokter tidak boleh akses pharmacy orders");
  console.log("OK staff non-pharmacist ditolak");

  await client.end();
  console.log("\nSemua smoke test lulus.");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
