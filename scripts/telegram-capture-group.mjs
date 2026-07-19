#!/usr/bin/env node
/**
 * Tangkap chat_id grup setelah bot di-mention di grup.
 * Jalankan lalu kirim pesan di grup: @Percobaan27_bot test
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
const POLL_SEC = Number(process.env.POLL_SEC ?? 90);

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const me = await tg("getMe");
console.log(`Bot: @${me.result?.username ?? "?"}`);
console.log(`Polling getUpdates ${POLL_SEC}s — kirim pesan di grup (mention bot) sekarang...\n`);

await tg("deleteWebhook", { drop_pending_updates: false });

const chats = new Map();
let offset = 0;
const end = Date.now() + POLL_SEC * 1000;

while (Date.now() < end) {
  const data = await fetch(`${API}/getUpdates?limit=100&offset=${offset}&timeout=10`).then((r) =>
    r.json()
  );
  for (const u of data.result ?? []) {
    offset = u.update_id + 1;
    const msg = u.message ?? u.edited_message;
    const cb = u.callback_query;
    const member = u.my_chat_member;
    const chat = msg?.chat ?? cb?.message?.chat ?? member?.chat;
    if (!chat?.id) continue;

    const key = String(chat.id);
    const text = msg?.text ?? cb?.data ?? member?.new_chat_member?.status ?? "";
    chats.set(key, {
      chat_id: chat.id,
      type: chat.type,
      title: chat.title ?? chat.first_name ?? "-",
      username: chat.username ? `@${chat.username}` : "-",
      last_text: String(text).slice(0, 80),
    });
    console.log(`[BARU] ${chat.id} | ${chat.type} | ${chat.title ?? chat.first_name} | ${text}`);
  }
  if ((data.result ?? []).length === 0) {
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const restore = await tg("setWebhook", {
  url: WEBHOOK,
  allowed_updates: ["callback_query"],
});

console.log(`\nWebhook dipulihkan: ${restore.ok ? "ya" : "tidak"}`);
console.log(`Total chat unik: ${chats.size}\n`);

if (chats.size === 0) {
  console.log("Tidak ada update. Mention sebelumnya mungkin hilang (webhook hanya callback_query).");
  console.log("Jalankan lagi lalu kirim pesan baru di grup.");
} else {
  for (const c of chats.values()) {
    const isGroup = c.type === "group" || c.type === "supergroup";
    console.log(
      `${isGroup ? ">>> GRUP" : "     "} chat_id=${c.chat_id} | ${c.type} | ${c.title} | ${c.last_text}`
    );
  }
}
