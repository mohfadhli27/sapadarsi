-- Resep digital konsultasi dokter DARSI
-- Jalankan: PGPASSWORD=PASSWORD psql -h localhost -U postgres -d hospital_cs -f scripts/migrate-prescription.sql

ALTER TABLE doctor_consultation_meta
  ADD COLUMN IF NOT EXISTS prescription jsonb;

CREATE INDEX IF NOT EXISTS idx_doctor_consultation_meta_prescription
  ON doctor_consultation_meta ((prescription IS NOT NULL))
  WHERE prescription IS NOT NULL;
