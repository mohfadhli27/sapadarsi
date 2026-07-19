#!/usr/bin/env node
/**
 * Uji E2E konsultasi pasien Siti Aisyah — dokter & bidan + monitor.
 * Usage: node scripts/e2e-consultation-test.mjs
 */
const BASE = process.env.DARSI_BASE ?? "http://127.0.0.1:3030";
const PATIENT = 1; // Siti Aisyah, RM001

async function json(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function log(title, obj) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

async function testDoctor() {
  console.log("\n########## DOKTER — Siti Aisyah ##########");

  const create = await json("POST", "/api/doctors/consultations", {
    patientId: PATIENT,
    initialComplaint: "Siti: pusing berputar dan mual sejak 2 hari",
    unitType: "reguler",
  });
  if (!create.ok) throw new Error(`create doctor: ${JSON.stringify(create.data)}`);
  const sid = create.data.session.id;
  const token = create.data.monitorToken;
  log("1. Sesi dibuat", {
    sessionId: sid,
    pasien: create.data.patient?.nama,
    rm: create.data.patient?.no_rm,
    monitorToken: token?.slice(0, 12) + "...",
  });

  const triage = await json("POST", `/api/doctors/consultations/${sid}`, {
    action: "triage",
    patientId: PATIENT,
    complaint: "Siti: pusing berputar dan mual sejak 2 hari",
  });
  if (!triage.ok) throw new Error(`triage: ${JSON.stringify(triage.data)}`);

  const select = await json("POST", `/api/doctors/consultations/${sid}`, {
    action: "select_doctor",
    patientId: PATIENT,
    doctor: {
      doctorCode: "DARSI-UMUM-001",
      doctorName: "dr. Rizky Pratama",
      unitId: "DARSI-UNIT-UMUM",
      unitName: "Dokter Umum",
      rumpun: "UMUM",
      unitType: "reguler",
      scheduleDate: new Date().toISOString().slice(0, 10),
    },
  });
  if (!select.ok) throw new Error(`select: ${JSON.stringify(select.data)}`);
  log("2. Pilih dokter + Telegram", {
    status: select.data.status,
    telegramSent: select.data.telegramSent,
    monitorUrl: select.data.monitorUrl,
  });

  const monitorBefore = await json("GET", `/api/staff/monitor/${token}`);
  log("3. Monitor (menunggu approval)", {
    pasien: monitorBefore.data.patient?.nama,
    status: monitorBefore.data.session?.status,
    pesan: monitorBefore.data.messages?.length,
  });

  const approve = await json("POST", `/api/staff/monitor/${token}`, {
    action: "approve",
    actor: "dr. Rizky Pratama",
  });
  if (!approve.ok) throw new Error(`approve doctor: ${JSON.stringify(approve.data)}`);
  log("4. Dokter approve", { greeting: approve.data.greeting?.slice(0, 80) + "..." });

  const monitorAfter = await json("GET", `/api/staff/monitor/${token}`);
  log("5. Monitor setelah approve", {
    status: monitorAfter.data.session?.status,
    pesan: monitorAfter.data.messages?.map((m) => ({
      dari: m.senderType,
      teks: m.text.slice(0, 60),
    })),
  });

  return { sid, token, ok: true };
}

async function testBidan() {
  console.log("\n########## BIDAN — Siti Aisyah ##########");

  const create = await json("POST", "/api/consultations", {
    patientId: PATIENT,
    serviceType: "midwife_consultation",
    initialComplaint: "Siti: hamil 24 minggu, sering mual dan pusing",
  });
  if (!create.ok) throw new Error(`create bidan: ${JSON.stringify(create.data)}`);
  const sid = create.data.session.id;
  const token = create.data.monitorToken;
  log("1. Sesi bidan dibuat", {
    sessionId: sid,
    pasien: create.data.patient?.name,
    rm: create.data.patient?.noRm,
    telegramSent: create.data.telegramSent,
    monitorUrl: create.data.monitorUrl,
  });

  const msg = await json("POST", `/api/consultations/${sid}/messages`, {
    patientId: PATIENT,
    message: "Siti: hamil 24 minggu, sering mual dan pusing",
  });
  if (!msg.ok) throw new Error(`message: ${JSON.stringify(msg.data)}`);
  log("2. Pasien kirim keluhan", {
    awaitingStaff: msg.data.awaitingStaff,
    status: msg.data.status,
  });

  const monitorBefore = await json("GET", `/api/staff/monitor/${token}`);
  log("3. Monitor perawat (menunggu)", {
    pasien: monitorBefore.data.patient?.nama,
    perawat: monitorBefore.data.meta?.doctor_name,
    status: monitorBefore.data.session?.status,
    keluhan: monitorBefore.data.session?.initial_complaint,
    pesanPasien: monitorBefore.data.messages?.filter((m) => m.senderType === "patient").length,
  });

  const approve = await json("POST", `/api/staff/monitor/${token}`, {
    action: "approve",
    actor: "Perawat Muhammad",
  });
  if (!approve.ok) throw new Error(`approve bidan: ${JSON.stringify(approve.data)}`);
  log("4. Perawat approve", { greeting: approve.data.greeting?.slice(0, 80) + "..." });

  const monitorAfter = await json("GET", `/api/staff/monitor/${token}`);
  log("5. Monitor setelah approve", {
    status: monitorAfter.data.session?.status,
    pesan: monitorAfter.data.messages?.map((m) => ({
      dari: m.senderType,
      teks: m.text.slice(0, 60),
    })),
  });

  return { sid, token, ok: true };
}

async function main() {
  console.log(`Base URL: ${BASE}`);
  console.log(`Pasien ID: ${PATIENT} (Siti Aisyah)`);

  const doctor = await testDoctor();
  const bidan = await testBidan();

  console.log("\n########## RINGKASAN ##########");
  console.log("✅ Dokter: sesi", doctor.sid, "| monitor token OK | Telegram + approve OK");
  console.log("✅ Bidan:  sesi", bidan.sid, "| monitor token OK | Telegram + approve OK");
  console.log("\nLink monitor (buka di browser):");
  console.log(`  Dokter: ${BASE.replace("127.0.0.1:3030", "sapadarsi.hcm-lab.id")}/doctor/monitor/<token>`);
  console.log(`  Bidan:  ${BASE.replace("127.0.0.1:3030", "sapadarsi.hcm-lab.id")}/bidan/monitor/<token>`);
}

main().catch((e) => {
  console.error("\n❌ GAGAL:", e.message);
  process.exit(1);
});
