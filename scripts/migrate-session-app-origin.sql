-- Simpan domain asal sesi (Sapabidan vs Sapadarsi) untuk link monitor & apotek
-- Jalankan: PGPASSWORD=PASSWORD psql -h localhost -U postgres -d hospital_cs -f scripts/migrate-session-app-origin.sql

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS app_origin_url varchar(255);

COMMENT ON COLUMN chat_sessions.app_origin_url IS
  'URL publik aplikasi saat sesi dibuat, mis. https://sapabidan.labvr.unusa.ac.id';
