-- Fase UI konsultasi dokter (untuk resume sesi pasien & dokter)
ALTER TABLE doctor_consultation_meta
  ADD COLUMN IF NOT EXISTS ui_phase varchar(30) NOT NULL DEFAULT 'triage';

CREATE INDEX IF NOT EXISTS idx_chat_sessions_doctor_patient
  ON chat_sessions (patient_id, session_type, updated_at DESC)
  WHERE session_type = 'doctor_consultation';

UPDATE doctor_consultation_meta dcm
SET ui_phase = CASE
  WHEN cs.status = 'waiting_approval' THEN 'waiting'
  WHEN cs.status = 'active' THEN 'live'
  WHEN cs.status = 'completed' THEN 'closed'
  WHEN cs.status = 'rejected' THEN 'rejected'
  WHEN dcm.doctor_code IS NOT NULL THEN 'waiting'
  ELSE 'selecting_doctor'
END
FROM chat_sessions cs
WHERE cs.id = dcm.session_id AND (dcm.ui_phase IS NULL OR dcm.ui_phase = 'triage');
