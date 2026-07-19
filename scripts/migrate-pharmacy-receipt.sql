-- Resi PDF pemesanan obat apotek (setelah pasien pilih antar / ambil)
-- Jalankan: psql "$DATABASE_URL" -f scripts/migrate-pharmacy-receipt.sql

ALTER TABLE pasienkonsul.pharmacy_prescription_orders
  ADD COLUMN IF NOT EXISTS receipt_no varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS receipt_pdf_path text NULL,
  ADD COLUMN IF NOT EXISTS receipt_pdf_file_name text NULL,
  ADD COLUMN IF NOT EXISTS receipt_pdf_size_bytes integer NULL;
