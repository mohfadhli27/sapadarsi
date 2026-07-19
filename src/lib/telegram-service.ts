/**
 * Notifikasi Telegram untuk dokter & bidan/perawat.
 * Butuh chat_id (bukan nomor HP) — dapatkan setelah user klik Start di bot.
 */

import { resolveDarsiPublicUrl } from "@/src/config/site";
import {
  buildPharmacyStaffPortalUrl,
  crossAppPublicUrl,
  resolveSessionPublicUrl,
} from "@/src/lib/session-app-origin";

export type TelegramNotifyResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

async function telegramApi(
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; result?: unknown; error?: string; migrateToChatId?: string }> {
  const token = botToken();
  if (!token) return { ok: false, error: "no token" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: unknown;
      description?: string;
      parameters?: { migrate_to_chat_id?: number };
    } | null;
    if (!res.ok || json?.ok === false) {
      const migrateTo = json?.parameters?.migrate_to_chat_id;
      if (migrateTo != null) {
        return {
          ok: false,
          error: json?.description ?? JSON.stringify(json).slice(0, 300),
          migrateToChatId: String(migrateTo),
        };
      }
      return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    }
    return { ok: true, result: json?.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Telegram API error" };
  }
}

async function sendWithMigrationRetry<T>(
  chatId: string,
  send: (targetChatId: string) => Promise<T & { ok: boolean; error?: string; migrateToChatId?: string }>
): Promise<T & { ok: boolean; error?: string; usedChatId: string }> {
  let target = chatId;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await send(target);
    if (result.ok) return { ...result, usedChatId: target };
    if (result.migrateToChatId && result.migrateToChatId !== target) {
      console.warn(
        `[telegram] grup pindah ke supergroup, pakai chat_id ${result.migrateToChatId} (dari ${target})`
      );
      target = result.migrateToChatId;
      continue;
    }
    return { ...result, usedChatId: target };
  }
  return { ok: false, error: "migrate retry exhausted", usedChatId: target } as T & {
    ok: boolean;
    error?: string;
    usedChatId: string;
  };
}

async function sendTelegramMessage(chatId: string, text: string): Promise<TelegramNotifyResult> {
  if (!chatId) return { ok: false, skipped: true };
  const r = await sendWithMigrationRetry(chatId, async (targetChatId) => {
    const api = await telegramApi("sendMessage", {
      chat_id: targetChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
    return api;
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function sendTelegramToChat(
  chatId: string,
  text: string
): Promise<TelegramNotifyResult> {
  return sendTelegramMessage(chatId, text);
}

export type InlineButton = { text: string; callback_data: string };

export type TelegramMessageRef = {
  chatId: string;
  messageId: number;
};

function extractMessageRef(chatId: string, result: unknown): TelegramMessageRef | undefined {
  const messageId = (result as { message_id?: number } | undefined)?.message_id;
  if (!messageId) return undefined;
  return { chatId, messageId };
}

export async function sendTelegramWithButtons(
  chatId: string,
  text: string,
  buttons: InlineButton[][]
): Promise<TelegramNotifyResult & { messageRef?: TelegramMessageRef }> {
  if (!chatId) return { ok: false, skipped: true };
  const r = await sendWithMigrationRetry(chatId, async (targetChatId) => {
    const api = await telegramApi("sendMessage", {
      chat_id: targetChatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
    return api;
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    messageRef: extractMessageRef(r.usedChatId, (r as { result?: unknown }).result),
  };
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text ?? "OK",
  });
}

export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
  options?: { removeButtons?: boolean }
): Promise<void> {
  await telegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(options?.removeButtons ? { reply_markup: { inline_keyboard: [] } } : {}),
  });
}

/** Satu grup Telegram untuk semua approval dokter & bidan/perawat. */
export function approvalGroupTelegramChatId(): string | null {
  return (
    process.env.TELEGRAM_APPROVAL_GROUP_CHAT_ID?.trim() ||
    process.env.TELEGRAM_DOCTOR_CHAT_ID?.trim() ||
    process.env.TELEGRAM_MIDWIFE_CHAT_ID?.trim() ||
    null
  );
}

export function doctorTelegramChatId(): string | null {
  return approvalGroupTelegramChatId();
}

export function midwifeTelegramChatId(): string | null {
  return approvalGroupTelegramChatId();
}

/** Semua konsultasi (dokter & bidan) → grup approval yang sama. */
export function resolveTelegramChatId(_doctorCode: string): string | null {
  return approvalGroupTelegramChatId();
}

export function practitionerRoleLabel(doctorCode: string): "Bidan" | "Perawat" | "Tenaga medis" {
  const code = doctorCode.toUpperCase();
  if (code.startsWith("PERAWAT-")) return "Perawat";
  if (code.startsWith("DARSI-BIDAN") || code.startsWith("BIDAN-")) return "Bidan";
  return "Tenaga medis";
}

export async function notifyConsultationTelegram(
  doctorCode: string,
  text: string
): Promise<TelegramNotifyResult> {
  const chatId = resolveTelegramChatId(doctorCode);
  if (!chatId) return { ok: false, skipped: true };
  return sendTelegramMessage(chatId, text);
}

const APPROVAL_BUTTONS = (sessionId: number): InlineButton[][] => [
  [
    { text: "✅ Setujui", callback_data: `approve:${sessionId}` },
    { text: "❌ Tolak", callback_data: `reject:${sessionId}` },
  ],
];

export function parseTelegramMessageRefs(raw: unknown): TelegramMessageRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: TelegramMessageRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { chatId?: unknown; messageId?: unknown };
    const chatId = String(row.chatId ?? "").trim();
    const messageId = Number(row.messageId);
    if (!chatId || !Number.isFinite(messageId)) continue;
    refs.push({ chatId, messageId });
  }
  return dedupeTelegramMessageRefs(refs);
}

export function dedupeTelegramMessageRefs(refs: TelegramMessageRef[]): TelegramMessageRef[] {
  const seen = new Set<string>();
  const out: TelegramMessageRef[] = [];
  for (const ref of refs) {
    const key = `${ref.chatId}:${ref.messageId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

export async function syncTelegramApprovalMessages(
  refs: TelegramMessageRef[],
  text: string,
  options?: { removeButtons?: boolean }
): Promise<void> {
  for (const ref of dedupeTelegramMessageRefs(refs)) {
    try {
      await editTelegramMessage(ref.chatId, ref.messageId, text, {
        removeButtons: options?.removeButtons ?? true,
      });
    } catch {
      /* pesan mungkin sudah dihapus */
    }
  }
}

export async function sendMonitorLinksToChats(input: {
  chatIds: string[];
  sessionId: number;
  staffName: string;
  monitorToken: string;
  monitorPrefix?: string;
  publicBaseUrl?: string | null;
}): Promise<void> {
  const originBase = resolveSessionPublicUrl(input.publicBaseUrl);
  const primaryLink = buildMonitorLink(
    input.monitorToken,
    input.monitorPrefix ?? "doctor",
    originBase
  );
  const alternateBase = crossAppPublicUrl(originBase);
  const alternateLink = alternateBase
    ? buildMonitorLink(input.monitorToken, input.monitorPrefix ?? "doctor", alternateBase)
    : null;

  const originLabel = originBase.includes("sapabidan") ? "Sapabidan" : "Sapadarsi";
  const alternateLabel = alternateBase?.includes("sapabidan") ? "Sapabidan" : "Sapadarsi";

  const linkLines = [
    `<a href="${primaryLink}">Buka monitor (${originLabel})</a>`,
    alternateLink
      ? `<a href="${alternateLink}">Buka monitor (${alternateLabel} — akses alternatif)</a>`
      : null,
  ].filter(Boolean);

  const text = [
    "🔗 <b>Link Monitor Konsultasi</b>",
    "",
    `Sesi #${input.sessionId} · ${input.staffName}`,
    "",
    ...linkLines,
    "",
    "Gunakan halaman ini untuk memantau chat pasien, mengambil alih, dan memoderasi pesan.",
    "Kedua link mengarah ke sesi yang sama.",
  ].join("\n");

  const groupId = approvalGroupTelegramChatId();
  const uniqueChatIds = [
    ...new Set([...input.chatIds.filter(Boolean), groupId].filter(Boolean)),
  ] as string[];
  for (const chatId of uniqueChatIds) {
    await sendTelegramToChat(chatId, text);
  }
}

export async function sendConsultationApprovalRequest(
  doctorCode: string,
  sessionId: number,
  text: string,
  _options?: { staffName?: string }
): Promise<TelegramNotifyResult & { messageRefs: TelegramMessageRef[] }> {
  const chatId = resolveTelegramChatId(doctorCode);
  if (!chatId) return { ok: false, skipped: true, messageRefs: [] };

  const primary = await sendTelegramWithButtons(chatId, text, APPROVAL_BUTTONS(sessionId));
  const messageRefs = primary.messageRef ? [primary.messageRef] : [];

  if (!primary.ok) {
    console.error(
      "[telegram] approval gagal terkirim",
      { sessionId, chatId, error: primary.error ?? "unknown" }
    );
  }

  return { ok: primary.ok, error: primary.error, messageRefs: dedupeTelegramMessageRefs(messageRefs) };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildApprovalRequestText(input: {
  patientName: string;
  patientRm: string;
  complaint: string;
  staffName: string;
  unitName?: string;
  scheduleDate?: string;
  roleLabel?: string;
}): string {
  const role = input.roleLabel ?? "Tenaga medis";
  return [
    `<b>🩺 Permintaan Konsultasi DARSI</b>`,
    "",
    `Pasien: <b>${escapeHtml(input.patientName)}</b> (${escapeHtml(input.patientRm)})`,
    `Keluhan: ${escapeHtml(input.complaint)}`,
    `${role}: <b>${escapeHtml(input.staffName)}</b>`,
    input.unitName ? `Unit: ${escapeHtml(input.unitName)}` : "",
    input.scheduleDate ? `Jadwal: ${escapeHtml(input.scheduleDate)}` : "",
    "",
    "Tap <b>Setujui</b> atau <b>Tolak</b> di bawah.",
    "Link monitor akan dikirim setelah persetujuan.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMonitorLink(
  monitorToken: string,
  pathPrefix = "doctor",
  publicBaseUrl?: string | null
): string {
  const base = resolveSessionPublicUrl(publicBaseUrl ?? process.env.DARSI_PUBLIC_URL);
  return `${base}/${pathPrefix}/monitor/${monitorToken}`;
}

export async function sendPharmacyOrderTelegram(input: {
  orderId: number;
  patientName: string;
  patientRm: string;
  prescriptionNo?: string | null;
  sourceOriginUrl?: string | null;
}): Promise<TelegramNotifyResult> {
  const chatId = approvalGroupTelegramChatId();
  if (!chatId) return { ok: false, skipped: true };

  const staffLink = buildPharmacyStaffPortalUrl(input.orderId);
  const sourceLabel = (input.sourceOriginUrl ?? "").includes("sapabidan")
    ? "Sapabidan"
    : "Sapadarsi";

  const text = [
    "💊 <b>Pesanan Resep Apotek DARSI</b>",
    "",
    `Order #${input.orderId}`,
    `Pasien: <b>${escapeHtml(input.patientName)}</b> (${escapeHtml(input.patientRm)})`,
    input.prescriptionNo ? `No. resep: ${escapeHtml(input.prescriptionNo)}` : "",
    `Asal konsultasi: ${sourceLabel}`,
    "",
    `<a href="${staffLink}">Buka portal apoteker (Sapadarsi)</a>`,
    "",
    "Pesanan terhubung ke sistem yang sama — dapat diproses dari portal Sapadarsi.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramToChat(chatId, text);
}

export async function getTelegramWebhookInfo(): Promise<{
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage: string | null;
  lastErrorDate: number | null;
}> {
  const r = await telegramApi("getWebhookInfo", {});
  const info = (r.result ?? {}) as {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
    last_error_date?: number;
  };
  return {
    url: info.url ?? "",
    pendingUpdateCount: info.pending_update_count ?? 0,
    lastErrorMessage: info.last_error_message ?? null,
    lastErrorDate: info.last_error_date ?? null,
  };
}

export async function registerWebhook(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const base = resolveDarsiPublicUrl(process.env.DARSI_PUBLIC_URL);
  const url = `${base}/api/telegram/webhook`;
  const r = await telegramApi("setWebhook", {
    url,
    allowed_updates: ["callback_query"],
    drop_pending_updates: true,
  });
  return { ok: r.ok, url, error: r.error };
}
