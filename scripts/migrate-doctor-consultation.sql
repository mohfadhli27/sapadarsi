-- Konsultasi dokter DARSI: session type, meta dokter RSI, moderasi pesan
-- Jalankan: PGPASSWORD=PASSWORD psql -h localhost -U postgres -d hospital_cs -f scripts/migrate-doctor-consultation.sql

ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_session_type_check;
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_session_type_check
  CHECK (session_type::text = ANY (ARRAY[
    'administrasi', 'asuransi', 'kasir', 'keluhan', 'informasi',
    'nurse_consultation', 'midwife_consultation', 'doctor_consultation'
  ]::text[]));

CREATE TABLE IF NOT EXISTS doctor_consultation_meta (
  session_id integer PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  unit_type varchar(20) NOT NULL DEFAULT 'reguler',
  unit_id varchar(120),
  unit_name varchar(200),
  rumpun varchar(200),
  doctor_code varchar(120),
  doctor_name varchar(200),
  doctor_schedule varchar(100),
  doctor_quota integer,
  schedule_date date,
  triage_summary text,
  recommended_units jsonb,
  monitor_token varchar(64) NOT NULL UNIQUE,
  telegram_sent_at timestamp without time zone,
  summary_card jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctor_consultation_meta_token
  ON doctor_consultation_meta(monitor_token);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS hidden_at timestamp without time zone;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_text text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS staff_actor varchar(100);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_takeover boolean NOT NULL DEFAULT false;
