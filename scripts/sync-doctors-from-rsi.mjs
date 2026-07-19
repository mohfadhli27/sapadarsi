#!/usr/bin/env node
/**
 * Trigger sinkronisasi dokter RSI via API (server harus berjalan).
 * Alternatif: panel Admin → Sinkronkan sekarang
 *
 * Usage:
 *   CRON_SECRET=... node scripts/sync-doctors-from-rsi.mjs
 */
const base = (process.env.DARSI_BASE ?? "http://127.0.0.1:3030").replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim();

if (!secret) {
  console.error("CRON_SECRET belum di-set. Gunakan panel /admin atau set di .env.local");
  process.exit(1);
}

const res = await fetch(`${base}/api/cron/sync-doctors`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.success) {
  console.error(data.message ?? data.result?.errors?.[0] ?? `HTTP ${res.status}`);
  process.exit(1);
}

console.log(`OK — ${data.result.doctorsSynced} dokter aktif disinkronkan`);
console.log(JSON.stringify(data.result, null, 2));
