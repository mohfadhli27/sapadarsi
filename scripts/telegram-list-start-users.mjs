#!/usr/bin/env node
/**
 * Daftar username yang pernah /start atau berinteraksi dengan bot (via getUpdates).
 * Jalankan: node scripts/telegram-list-start-users.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const TOKEN = env.TELEGRAM_BOT_TOKEN;
const WEBHOOK = `${(env.DARSI_PUBLIC_URL ?? "").replace(/\/$/, "")}/api/telegram/webhook`;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const me = await tg("getMe");
console.log(`Bot: @${me.result?.username ?? "?"} (${me.result?.first_name ?? ""})`);

const whBefore = await tg("getWebhookInfo");
console.log(`Webhook: ${whBefore.result?.url || "(kosong)"}`);
console.log(`Pending updates: ${whBefore.result?.pending_update_count ?? 0}`);
console.log(`Allowed updates: ${(whBefore.result?.allowed_updates ?? ["all"]).join(", ")}\n`);

await tg("deleteWebhook");

const users = new Map();
let offset = 0;
let totalUpdates = 0;

for (;;) {
  const data = await fetch(`${API}/getUpdates?limit=100&offset=${offset}`).then((r) => r.json());
  if (!data.ok) {
    console.error("getUpdates gagal:", data.description);
    break;
  }
  const batch = data.result ?? [];
  if (batch.length === 0) break;

  for (const u of batch) {
    totalUpdates++;
    offset = u.update_id + 1;

    const msg = u.message ?? u.edited_message;
    const cb = u.callback_query;
    const from = msg?.from ?? cb?.from ?? u.my_chat_member?.from;
    const chat = msg?.chat ?? cb?.message?.chat ?? u.my_chat_member?.chat;
    if (!from?.id) continue;

    const text = msg?.text ?? "";
    const isStart = /^\/start\b/.test(text);
    const key = String(from.id);

    const row = users.get(key) ?? {
      user_id: from.id,
      username: from.username ? `@${from.username}` : "(tanpa username)",
      name: `${from.first_name ?? ""} ${from.last_name ?? ""}`.trim(),
      chat_id: chat?.id ?? from.id,
      pressed_start: false,
      interactions: 0,
      last_action: "",
    };

    row.interactions++;
    if (isStart) row.pressed_start = true;
    if (text) row.last_action = text.slice(0, 80);
    else if (cb?.data) row.last_action = `callback: ${cb.data}`;
    else if (u.my_chat_member) row.last_action = "my_chat_member";

    users.set(key, row);
  }

  if (batch.length < 100) break;
}

const restore = await tg("setWebhook", {
  url: WEBHOOK,
  allowed_updates: ["callback_query"],
});

console.log(`Total update di queue: ${totalUpdates}`);
console.log(`User unik: ${users.size}`);
console.log(`Yang pernah /start: ${[...users.values()].filter((u) => u.pressed_start).length}`);
console.log(`Webhook dipulihkan: ${restore.ok ? "ya" : "tidak"}\n`);

if (users.size === 0) {
  console.log("Tidak ada user di queue getUpdates.");
  console.log("Telegram hanya menyimpan update belum terbaca (~24 jam).");
  console.log("Webhook saat ini hanya callback_query — pesan /start tidak disimpan otomatis.");
} else {
  for (const u of users.values()) {
    console.log(
      `${u.pressed_start ? "[START]" : "[     ]"} ${u.username} | ${u.name} | chat_id=${u.chat_id} | ${u.interactions}x | ${u.last_action}`
    );
  }
}

// Chat ID yang sudah dikonfigurasi di .env (penerima notifikasi)
const configured = [
  ["Grup approval", env.TELEGRAM_APPROVAL_GROUP_CHAT_ID],
  ["Dokter (legacy)", env.TELEGRAM_DOCTOR_CHAT_ID],
  ["Bidan/Perawat (legacy)", env.TELEGRAM_MIDWIFE_CHAT_ID],
].filter(([, id]) => id);

if (configured.length) {
  console.log("\n--- Chat terdaftar di .env ---");
  for (const [label, chatId] of configured) {
    const chat = await tg("getChat", { chat_id: chatId });
    if (chat.ok) {
      const c = chat.result;
      const uname = c.username ? `@${c.username}` : "-";
      const title = c.title ?? c.first_name ?? "-";
      console.log(`${label}: chat_id=${chatId} | ${uname} | ${title} | type=${c.type}`);
    } else {
      console.log(`${label}: chat_id=${chatId} | (getChat gagal: ${chat.description})`);
    }
  }
}
