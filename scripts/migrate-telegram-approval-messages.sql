-- Simpan referensi pesan Telegram (chat_id + message_id) untuk sync approval multi-penerima
ALTER TABLE doctor_consultation_meta
  ADD COLUMN IF NOT EXISTS telegram_approval_messages jsonb NOT NULL DEFAULT '[]'::jsonb;
