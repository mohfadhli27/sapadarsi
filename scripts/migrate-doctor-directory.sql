-- Direktori dokter RSI + penugasan staff per konsultasi
CREATE TABLE IF NOT EXISTS pasienkonsul.darsi_doctor_directory (
  id serial PRIMARY KEY,
  doctor_code varchar(120) NOT NULL UNIQUE,
  doctor_name varchar(200) NOT NULL,
  unit_id varchar(120),
  unit_name varchar(200) NOT NULL,
  rumpun varchar(200),
  unit_type varchar(20) NOT NULL DEFAULT 'reguler',
  schedule_label varchar(100),
  quota_remaining integer,
  quota_total integer,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctor_directory_unit
  ON pasienkonsul.darsi_doctor_directory (unit_id)
  WHERE is_active = true;

ALTER TABLE doctor_consultation_meta
  ADD COLUMN IF NOT EXISTS assigned_staff_id integer
  REFERENCES pasienkonsul.darsi_staff_accounts(id);

CREATE INDEX IF NOT EXISTS idx_doctor_consultation_assigned_staff
  ON doctor_consultation_meta (assigned_staff_id)
  WHERE assigned_staff_id IS NOT NULL;

-- Nonaktifkan akun demo lama
UPDATE pasienkonsul.darsi_staff_accounts
SET is_active = false
WHERE username IN ('dr_demo', 'koordinator');
