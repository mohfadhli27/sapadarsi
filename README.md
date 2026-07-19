# SAPADARSI

**Sistem Asisten Pasien Digital RSI Surabaya A. Yani** — aplikasi web konsultasi kesehatan berbasis AI untuk pasien rumah sakit, dikembangkan bersama Yarsis (Yayasan Rumah Sakit Islam Surabaya).

SAPADARSI membantu pasien melakukan konsultasi awal dengan agent AI **dokter**, **bidan**, dan **apoteker**, dilengkapi portal staff untuk monitoring dan alur persetujuan via Telegram.

> **Catatan medis:** SAPADARSI adalah asisten digital untuk triase dan konsultasi awal. Bukan pengganti diagnosis atau resep resmi dokter. Keputusan klinis tetap menjadi tanggung jawab tenaga medis.

---

## Fitur Utama

| Modul | Deskripsi |
|-------|-----------|
| Konsultasi Dokter | Triase keluhan, pemilihan dokter spesialis, wawancara klinis bertahap, ringkasan & resep digital |
| Konsultasi Bidan | Konsultasi kehamilan, kesehatan ibu, dan tumbuh kembang anak |
| Konsultasi Apoteker | Screening obat, dosis, interaksi, dan saran penggunaan |
| Portal Staff | Monitor sesi live, notifikasi, dan takeover konsultasi oleh tenaga medis |
| Portal Admin | Manajemen akun staff dan sinkronisasi direktori dokter RSI |
| Telegram Approval | Notifikasi grup Telegram saat konsultasi membutuhkan persetujuan |

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, Radix UI, Framer Motion |
| State | Zustand |
| Database | PostgreSQL |
| AI / LLM | Ollama / vLLM (OpenAI-compatible), orchestrator konsultasi |
| Integrasi | API RSI Surabaya, Telegram Bot API |
| Runtime | Node.js ≥ 20, PM2 (opsional) |

---

## Arsitektur (ringkas)

```text
Pasien / Staff  →  SAPADARSI (Next.js :3030)
                        ├── PostgreSQL
                        ├── LLM (Ollama / vLLM)
                        ├── API RSI Surabaya
                        └── Telegram Bot
```

Alur konsultasi dokter/bidan:

1. Pasien memulai sesi → agent AI mewawancarai (*gathering* → *assessment* → *closing*).
2. Respons divalidasi agar tidak mengulang pertanyaan generik.
3. Jika diperlukan, notifikasi persetujuan dikirim ke grup Telegram.
4. Staff memantau sesi; tenaga medis dapat *takeover* bila perlu.

---

## Prasyarat

- Node.js ≥ 20 dan npm ≥ 10
- PostgreSQL (database sesuai `DATABASE_URL`)
- Ollama atau endpoint LLM OpenAI-compatible (opsional untuk fitur AI penuh)
- Telegram Bot + grup approval (opsional)

---

## Instalasi

```bash
git clone https://github.com/mohfadhli27/sapadarsi.git
cd sapadarsi

npm install
cp .env.example .env.local
# Edit .env.local — isi DATABASE_URL, JWT_SECRET, dan konfigurasi LLM

npm run dev
```

Aplikasi berjalan di **http://localhost:3030**.

---

## Variabel Lingkungan

Salin `.env.example` ke `.env.local`. **Jangan commit file yang berisi secret.**

### Database & Auth

| Variabel | Wajib | Deskripsi |
|----------|-------|-----------|
| `DATABASE_URL` | Ya | Connection string PostgreSQL |
| `JWT_SECRET` | Ya | Secret verifikasi JWT |
| `NEXT_PUBLIC_AUTH_API_URL` | Opsional | URL auth API (default `http://localhost:4500`) |
| `NEXT_PUBLIC_DEMO_LOGIN` | Opsional | Tombol login demo (`true` / `false`) |

### LLM

| Variabel | Deskripsi |
|----------|-----------|
| `LLM_PROFILE` | Profil LLM (contoh: `ollama-local-8b`) |
| `OLLAMA_HOST` | Host Ollama (contoh: `http://127.0.0.1:11434`) |
| `OLLAMA_MODEL` | Nama model Ollama |
| `CHAT_API_BASE_URL` | Endpoint OpenAI-compatible (jika dipakai) |

### Telegram & Publik

| Variabel | Deskripsi |
|----------|-----------|
| `TELEGRAM_BOT_TOKEN` | Token bot dari BotFather |
| `TELEGRAM_APPROVAL_GROUP_CHAT_ID` | Chat ID grup approval |
| `DARSI_PUBLIC_URL` | URL publik aplikasi |
| `NEXT_PUBLIC_APP_VARIANT` | Harus `sapadarsi` |
| `NEXT_PUBLIC_PUBLIC_BASE_URL` | Base URL publik SAPADARSI |

Template lengkap ada di `.env.example`.

---

## Scripts

| Perintah | Deskripsi |
|----------|-----------|
| `npm run dev` | Development server (port 3030) |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan build produksi |
| `npm run lint` | ESLint |

### Migrasi database (opsional)

```bash
psql "$DATABASE_URL" -f scripts/migrate-patient-accounts.sql
psql "$DATABASE_URL" -f scripts/migrate-doctor-consultation.sql
psql "$DATABASE_URL" -f scripts/migrate-consultation-phase.sql
psql "$DATABASE_URL" -f scripts/migrate-prescription.sql
psql "$DATABASE_URL" -f scripts/migrate-staff-portal.sql
psql "$DATABASE_URL" -f scripts/migrate-doctor-directory.sql
psql "$DATABASE_URL" -f scripts/migrate-telegram-approval-messages.sql
psql "$DATABASE_URL" -f scripts/migrate-admin-sync.sql
```

---

## Deploy (PM2)

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

Sesuaikan `cwd` di `ecosystem.config.cjs` jika path deployment berbeda.

---

## Struktur Proyek

```text
sapadarsi/
├── app/                 # Next.js App Router (pages + API routes)
├── src/
│   ├── components/      # Komponen UI
│   ├── config/          # Konfigurasi variant & agent
│   ├── hooks/           # React hooks
│   ├── lib/             # Logika bisnis, LLM, DB, Telegram
│   ├── stores/          # Zustand stores
│   └── types/
├── scripts/             # Migrasi, seed, utilitas
├── public/              # Aset statis & logo
├── ecosystem.config.cjs # Konfigurasi PM2
└── .env.example         # Template environment (tanpa secret)
```

---

## Keamanan

- Jangan commit `.env`, `.env.local`, token Telegram, atau kredensial database.
- Set `NEXT_PUBLIC_DEMO_LOGIN=false` di produksi.
- Gunakan `JWT_SECRET` yang kuat dan unik per environment.
- File sensitif dilindungi melalui `.gitignore`.

---

## Lisensi

© Yarsis / RSI Surabaya A. Yani. Hubungi maintainer untuk pertanyaan lisensi dan kolaborasi.
