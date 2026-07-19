import { NextRequest, NextResponse } from "next/server";
import {
  approvalGroupTelegramChatId,
  getTelegramWebhookInfo,
  registerWebhook,
  sendTelegramToChat,
} from "@/src/lib/telegram-service";

function tokenConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export async function GET(req: NextRequest) {
  const ping = req.nextUrl.searchParams.get("ping") === "1";
  const webhookInfo = req.nextUrl.searchParams.get("webhook") === "1";
  const register = req.nextUrl.searchParams.get("registerWebhook") === "1";
  const chatId = approvalGroupTelegramChatId();
  const configured = tokenConfigured() && Boolean(chatId);

  if (webhookInfo || register) {
    if (!tokenConfigured()) {
      return NextResponse.json(
        { success: false, message: "TELEGRAM_BOT_TOKEN belum dikonfigurasi" },
        { status: 503 }
      );
    }

    if (register) {
      const reg = await registerWebhook();
      const info = await getTelegramWebhookInfo();
      return NextResponse.json({
        success: reg.ok,
        registered: reg.ok,
        webhookUrl: reg.url,
        error: reg.error ?? null,
        webhook: info,
      });
    }

    const info = await getTelegramWebhookInfo();
    return NextResponse.json({ success: true, webhook: info });
  }

  if (!ping) {
    return NextResponse.json({
      success: true,
      tokenConfigured: tokenConfigured(),
      chatIdConfigured: Boolean(chatId),
      ready: configured,
    });
  }

  if (!configured || !chatId) {
    return NextResponse.json(
      {
        success: false,
        message: "Telegram belum dikonfigurasi (TELEGRAM_BOT_TOKEN / TELEGRAM_APPROVAL_GROUP_CHAT_ID)",
        tokenConfigured: tokenConfigured(),
        chatIdConfigured: Boolean(chatId),
      },
      { status: 503 }
    );
  }

  const result = await sendTelegramToChat(
    chatId,
    "✅ Test koneksi approval DARSI — bot dapat mengirim ke grup ini."
  );

  return NextResponse.json({
    success: result.ok,
    tokenConfigured: true,
    chatIdConfigured: true,
    ping: result.ok ? "sent" : "failed",
    error: result.error ?? null,
  });
}
