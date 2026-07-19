-- Portal pekerja DARSI: akun staff, sesi login, notifikasi in-app
-- Jalankan: PGPASSWORD=PASSWORD psql -h localhost -U postgres -d hospital_cs -f scripts/migrate-staff-portal.sql

CREATE TABLE IF NOT EXISTS pasienkonsul.darsi_staff_accounts (
  id serial PRIMARY KEY,
  email varchar(255) NOT NULL,
  username varchar(100) NOT NULL,
  password_hash text NOT NULL,
  role varchar(30) NOT NULL DEFAULT 'doctor',
  doctor_code varchar(120),
  display_name varchar(200) NOT NULL,
  unit_name varchar(200),
  phone varchar(30),
  notify_all boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT darsi_staff_accounts_email_key UNIQUE (email),
  CONSTRAINT darsi_staff_accounts_username_key UNIQUE (username)
);

CREATE INDEX IF NOT EXISTS idx_darsi_staff_accounts_doctor_code
  ON pasienkonsul.darsi_staff_accounts (doctor_code)
  WHERE doctor_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS pasienkonsul.staff_sessions (
  id serial PRIMARY KEY,
  staff_id integer NOT NULL REFERENCES pasienkonsul.darsi_staff_accounts(id) ON DELETE CASCADE,
  token varchar(64) NOT NULL,
  expires_at timestamp without time zone NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT staff_sessions_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_token
  ON pasienkonsul.staff_sessions (token);

CREATE TABLE IF NOT EXISTS pasienkonsul.staff_notifications (
  id serial PRIMARY KEY,
  staff_id integer NOT NULL REFERENCES pasienkonsul.darsi_staff_accounts(id) ON DELETE CASCADE,
  session_id integer NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL,
  title varchar(200) NOT NULL,
  body text,
  link_path varchar(500),
  read_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_staff_created
  ON pasienkonsul.staff_notifications (staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_unread
  ON pasienkonsul.staff_notifications (staff_id)
  WHERE read_at IS NULL;
