-- Mode ambil alih dokter: matikan LLM sementara saat dokter mengetik langsung
-- Jalankan: PGPASSWORD=PASSWORD psql -h localhost -U postgres -d hospital_cs -f scripts/migrate-doctor-takeover-mode.sql

ALTER TABLE doctor_consultation_meta
  ADD COLUMN IF NOT EXISTS doctor_takeover_active boolean NOT NULL DEFAULT false;
