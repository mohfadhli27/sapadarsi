#!/usr/bin/env node
/**
 * Daftarkan ulang webhook Telegram ke DARSI_PUBLIC_URL.
 * Jalankan setelah ganti domain: node scripts/telegram-register-webhook.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const path = resolve(__dirname, "../.env.local");
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const env = loadEnv();
const token = env.TELEGRAM_BOT_TOKEN;
const base = (env.DARSI_PUBLIC_URL || "https://sapadarsi.hcm-lab.id").replace(/\/$/, "");
const webhookUrl = `${base}/api/telegram/webhook`;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN tidak ada di .env.local");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${token}`;

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const before = await tg("getWebhookInfo");
console.log("Webhook sebelumnya:", before.result?.url || "(kosong)");
if (before.result?.last_error_message) {
  console.log("Error terakhir:", before.result.last_error_message);
}

const set = await tg("setWebhook", {
  url: webhookUrl,
  allowed_updates: ["callback_query"],
  drop_pending_updates: true,
});

if (!set.ok) {
  console.error("setWebhook gagal:", set.description);
  process.exit(1);
}

const after = await tg("getWebhookInfo");
console.log("Webhook sekarang :", after.result?.url);
console.log("OK — tombol Setujui/Tolak Telegram aktif ke", webhookUrl);
