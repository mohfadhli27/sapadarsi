import { NextRequest, NextResponse } from "next/server";
import {
  answerCallbackQuery,
  buildMonitorLink,
  parseTelegramMessageRefs,
  sendMonitorLinksToChats,
  syncTelegramApprovalMessages,
  type TelegramMessageRef,
} from "@/src/lib/telegram-service";
import {
  approveDoctorSession,
  rejectDoctorSession,
} from "@/src/lib/doctor-consultation-service";
import {
  approveMidwifeSession,
  rejectMidwifeSession,
} from "@/src/lib/consultation-service";
import { dbQuery } from "@/src/lib/db";

type CallbackQuery = {
  id: string;
  from: { id: number; first_name?: string };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
};

type TelegramUpdate = {
  update_id: number;
  callback_query?: CallbackQuery;
};

function collectMessageRefs(
  stored: unknown,
  current?: TelegramMessageRef
): TelegramMessageRef[] {
  const refs = parseTelegramMessageRefs(stored);
  if (current) refs.push(current);
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.chatId}:${ref.messageId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: NextRequest) {
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false });
  }

  const cb = update.callback_query;
  if (!cb?.data || !cb.message) {
    return NextResponse.json({ ok: true });
  }

  const [action, sessionIdStr] = cb.data.split(":");
  const sessionId = Number(sessionIdStr);
  if (!sessionId || !Number.isFinite(sessionId)) {
    await answerCallbackQuery(cb.id, "Sesi tidak valid");
    return NextResponse.json({ ok: true });
  }

  const chatId = String(cb.message.chat.id);
  const messageId = cb.message.message_id;
  const actorName = cb.from.first_name ?? "Staf";
  const currentRef: TelegramMessageRef = { chatId, messageId };

  try {
    const sessionRow = await dbQuery<{
      session_type: string;
      status: string;
      app_origin_url: string | null;
    }>(
      `select session_type, status, app_origin_url from chat_sessions where id = $1 limit 1`,
      [sessionId]
    );
    const session = sessionRow.rows[0];
    if (!session) {
      await answerCallbackQuery(cb.id, "Sesi tidak ditemukan");
      return NextResponse.json({ ok: true });
    }

    const metaRow = await dbQuery<{
      monitor_token: string | null;
      doctor_name: string | null;
      telegram_approval_messages: unknown;
    }>(
      `select monitor_token, doctor_name, telegram_approval_messages
       from doctor_consultation_meta where session_id = $1 limit 1`,
      [sessionId]
    );
    const meta = metaRow.rows[0];
    const messageRefs = collectMessageRefs(meta?.telegram_approval_messages, currentRef);

    const sessionType = session.session_type ?? "doctor_consultation";
    const isMidwife =
      sessionType === "midwife_consultation" || sessionType === "nurse_consultation";
    const roleLabel = isMidwife ? "Bidan/Perawat" : "Dokter";
    const monitorPrefix = isMidwife ? "bidan" : "doctor";
    const staffName = meta?.doctor_name ?? actorName;
    const token = meta?.monitor_token ?? null;

    if (action === "approve") {
      const alreadyProcessed = session.status !== "waiting_approval";

      if (alreadyProcessed) {
        const statusText =
          session.status === "rejected"
            ? "❌ <b>Konsultasi Ditolak</b>"
            : "✅ <b>Konsultasi Disetujui</b>";

        await answerCallbackQuery(cb.id, "Sesi sudah diproses sebelumnya");
        await syncTelegramApprovalMessages(
          messageRefs,
          [
            statusText,
            "",
            `Sesi #${sessionId}`,
            `${roleLabel}: <b>${staffName}</b>`,
            alreadyProcessed && session.status !== "rejected"
              ? "Status: Konsultasi aktif"
              : "Pasien akan diminta memilih tenaga medis lain.",
          ].join("\n")
        );
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(cb.id, "Memproses persetujuan...");

      if (isMidwife) {
        await approveMidwifeSession(sessionId, actorName, undefined, { skipOpeningAi: true });
      } else {
        await approveDoctorSession(sessionId, actorName, { skipOpeningAi: true });
      }

      const approvedText = [
        "✅ <b>Konsultasi Disetujui</b>",
        "",
        `Sesi #${sessionId}`,
        `${roleLabel}: <b>${staffName}</b>`,
        `Disetujui oleh: ${actorName}`,
        "Status: Konsultasi aktif",
      ].join("\n");

      await syncTelegramApprovalMessages(messageRefs, approvedText);

      if (token) {
        await sendMonitorLinksToChats({
          chatIds: messageRefs.map((ref) => ref.chatId),
          sessionId,
          staffName,
          monitorToken: token,
          monitorPrefix,
          publicBaseUrl: session.app_origin_url,
        });
      }
    } else if (action === "reject") {
      const alreadyProcessed = session.status !== "waiting_approval";

      if (alreadyProcessed) {
        await answerCallbackQuery(cb.id, "Sesi sudah diproses sebelumnya");
        await syncTelegramApprovalMessages(
          messageRefs,
          [
            session.status === "rejected"
              ? "❌ <b>Konsultasi Ditolak</b>"
              : "✅ <b>Konsultasi Disetujui</b>",
            "",
            `Sesi #${sessionId}`,
            `${roleLabel}: <b>${staffName}</b>`,
          ].join("\n")
        );
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(cb.id, "Memproses penolakan...");

      if (isMidwife) {
        await rejectMidwifeSession(sessionId, undefined, actorName);
      } else {
        await rejectDoctorSession(sessionId, undefined, actorName);
      }

      await syncTelegramApprovalMessages(
        messageRefs,
        [
          "❌ <b>Konsultasi Ditolak</b>",
          "",
          `Sesi #${sessionId}`,
          `Ditolak oleh: ${actorName}`,
          "Pasien akan diminta memilih tenaga medis lain.",
        ].join("\n")
      );
    } else {
      await answerCallbackQuery(cb.id, "Aksi tidak dikenal");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memproses";
    await answerCallbackQuery(cb.id, msg.slice(0, 200));
    console.error("[telegram-webhook]", err);
  }

  return NextResponse.json({ ok: true });
}
