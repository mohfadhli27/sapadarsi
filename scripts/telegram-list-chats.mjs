#!/usr/bin/env node
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
const WEBHOOK = `${env.DARSI_PUBLIC_URL.replace(/\/$/, "")}/api/telegram/webhook`;

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const del = await tg("deleteWebhook");
console.log("deleteWebhook:", del.ok);

const updates = await fetch(
  `https://api.telegram.org/bot${TOKEN}/getUpdates?limit=100`
).then((r) => r.json());

const chats = new Map();
for (const u of updates.result ?? []) {
  const from = u.message?.from ?? u.callback_query?.from;
  const chat = u.message?.chat ?? u.callback_query?.message?.chat;
  if (!chat?.id) continue;
  chats.set(String(chat.id), {
    chat_id: chat.id,
    username: from?.username ? `@${from.username}` : "-",
    name: `${from?.first_name ?? ""} ${from?.last_name ?? ""}`.trim(),
  });
}

console.log("Chats found:", chats.size);
for (const c of chats.values()) {
  console.log(`  ${c.chat_id}  ${c.username}  ${c.name}`);
}

const restore = await tg("setWebhook", {
  url: WEBHOOK,
  allowed_updates: ["callback_query"],
});
console.log("restoreWebhook:", restore.ok);
