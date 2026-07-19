#!/usr/bin/env node
/**
 * Tes kirim notifikasi Telegram untuk dokter & perawat.
 * Usage: node scripts/test-telegram-notify.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const TOKEN = env.TELEGRAM_BOT_TOKEN;
const APPROVAL_GROUP =
  env.TELEGRAM_APPROVAL_GROUP_CHAT_ID ||
  env.TELEGRAM_DOCTOR_CHAT_ID ||
  env.TELEGRAM_MIDWIFE_CHAT_ID;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { ok: json.ok, description: json.description, result: json.result };
}

function resolveChatId() {
  return APPROVAL_GROUP;
}

async function sendApproval(doctorCode, sessionId, label) {
  const chatId = resolveChatId();
  console.log(`\n--- Tes ${label} (kode: ${doctorCode}, chat_id: ${chatId}) ---`);
  const text = [
    `<b>🧪 Tes Notifikasi ${label} — DARSI</b>`,
    "",
    "Ini pesan uji coba sistem notifikasi konsultasi.",
    `Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
    `Sesi uji: #${sessionId}`,
    "",
    "Silakan tekan tombol di bawah (uji coba):",
  ].join("\n");

  const r = await tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Setujui Konsultasi", callback_data: `approve:${sessionId}` },
          { text: "❌ Tolak", callback_data: `reject:${sessionId}` },
        ],
      ],
    },
  });
  console.log(r.ok ? "✅ Terkirim" : `❌ Gagal: ${r.description}`);
  return r.ok;
}

async function main() {
  if (!TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN tidak ada di .env.local");
    process.exit(1);
  }

  const wh = await tg("getWebhookInfo", {});
  console.log("Webhook URL:", wh.result?.url || "(kosong)");
  console.log("Pending updates:", wh.result?.pending_update_count ?? 0);

  const doctorOk = await sendApproval("DARSI-UMUM-001", 9001, "Dokter (dr. Rizky Pratama)");
  const nurseOk = await sendApproval("PERAWAT-muh", 9002, "Perawat (Muhammad)");

  console.log("\n=== Ringkasan ===");
  console.log(`Dokter  : ${doctorOk ? "OK" : "GAGAL"}`);
  console.log(`Perawat : ${nurseOk ? "OK" : "GAGAL"}`);
  console.log(`\nGrup approval: ${APPROVAL_GROUP ?? "(belum di-set)"}`);
  process.exit(doctorOk && nurseOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
