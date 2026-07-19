-- Pharmacy prescription order workflow (upload PDF + DARSI digital prescription)
-- Jalankan: psql "$DATABASE_URL" -f scripts/migrate-pharmacy-prescription-orders.sql

ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_session_type_check;
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_session_type_check
  CHECK (session_type::text = ANY (ARRAY[
    'administrasi', 'asuransi', 'kasir', 'keluhan', 'informasi',
    'nurse_consultation', 'midwife_consultation', 'doctor_consultation',
    'pharmacist_consultation'
  ]::text[]));

CREATE TABLE IF NOT EXISTS pasienkonsul.pharmacy_prescription_orders (
  id serial PRIMARY KEY,
  session_id integer NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  patient_id integer NOT NULL,
  source_type varchar(30) NOT NULL,
  source_consultation_session_id integer NULL,
  prescription_no varchar(100) NULL,
  pdf_file_name text NULL,
  pdf_file_path text NULL,
  pdf_mime_type varchar(100) NULL,
  pdf_size_bytes integer NULL,
  status varchar(50) NOT NULL,
  total_price numeric(14,2) NULL,
  patient_note text NULL,
  pharmacist_note text NULL,
  patient_decision varchar(30) NULL,
  delivery_address text NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at timestamp without time zone NULL,
  ready_at timestamp without time zone NULL,
  decided_at timestamp without time zone NULL,
  completed_at timestamp without time zone NULL,
  canceled_at timestamp without time zone NULL
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_session
  ON pasienkonsul.pharmacy_prescription_orders (session_id);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_patient
  ON pasienkonsul.pharmacy_prescription_orders (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status
  ON pasienkonsul.pharmacy_prescription_orders (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS pasienkonsul.pharmacy_prescription_order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES pasienkonsul.pharmacy_prescription_orders(id) ON DELETE CASCADE,
  drug_name text NOT NULL,
  quantity text NULL,
  unit text NULL,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  availability_status varchar(30) NOT NULL DEFAULT 'available',
  note text NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order
  ON pasienkonsul.pharmacy_prescription_order_items (order_id);

CREATE TABLE IF NOT EXISTS pasienkonsul.pharmacy_prescription_order_events (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES pasienkonsul.pharmacy_prescription_orders(id) ON DELETE CASCADE,
  actor_type varchar(30) NOT NULL,
  actor_name text NULL,
  event_type varchar(50) NOT NULL,
  old_status varchar(50) NULL,
  new_status varchar(50) NULL,
  payload jsonb NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_events_order
  ON pasienkonsul.pharmacy_prescription_order_events (order_id, created_at DESC);
