-- Log sinkronisasi otomatis + metadata admin DARSI

CREATE TABLE IF NOT EXISTS pasienkonsul.darsi_sync_runs (
  id serial PRIMARY KEY,
  sync_type varchar(50) NOT NULL DEFAULT 'doctor_rsi',
  status varchar(20) NOT NULL,
  schedule_date date,
  doctors_synced integer NOT NULL DEFAULT 0,
  doctors_created integer NOT NULL DEFAULT 0,
  doctors_deactivated integer NOT NULL DEFAULT 0,
  triggered_by varchar(50),
  staff_id integer REFERENCES pasienkonsul.darsi_staff_accounts(id) ON DELETE SET NULL,
  error_message text,
  details jsonb,
  started_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at timestamp without time zone
);

CREATE INDEX IF NOT EXISTS idx_darsi_sync_runs_started
  ON pasienkonsul.darsi_sync_runs (started_at DESC);
