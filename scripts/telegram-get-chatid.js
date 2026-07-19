#!/usr/bin/env node
/**
 * Poll Telegram getUpdates untuk menangkap chat_id.
 * Minta dokter/bidan kirim /start ke bot, lalu script ini akan menampilkan chat_id.
 * Jalankan: node scripts/telegram-get-chatid.js
 * Tekan Ctrl+C untuk berhenti.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8974027149:AAFUBLwBK6w8JuvJVxL_iyw8yGlTJhjLQUk";
const API = `https://api.telegram.org/bot${TOKEN}`;

let lastUpdateId = 0;
const seen = new Set();

async function poll() {
  try {
    const url = `${API}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok || !data.result?.length) return;

    for (const update of data.result) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      const msg = update.message;
      if (!msg?.from) continue;

      const chatId = msg.chat.id;
      const from = msg.from;
      const key = `${chatId}`;

      if (!seen.has(key)) {
        seen.add(key);
        console.log("=== BARU ===");
        console.log(`  chat_id   : ${chatId}`);
        console.log(`  nama      : ${from.first_name || ""} ${from.last_name || ""}`);
        console.log(`  username  : @${from.username || "-"}`);
        console.log(`  pesan     : ${msg.text || "(non-text)"}`);
        console.log("");
      }
    }
  } catch (err) {
    console.error("Poll error:", err.message);
  }
}

console.log("Menunggu pesan masuk ke bot @darsi_consul_bot...");
console.log("Minta dokter/bidan kirim /start atau pesan apapun ke bot.");
console.log("Tekan Ctrl+C untuk berhenti.\n");

setInterval(poll, 3000);
poll();
