# SAPADARSI

**Sistem Asisten Pasien Digital RSI Surabaya A. Yani** — aplikasi web konsultasi kesehatan berbasis AI untuk pasien rumah sakit, dikembangkan bersama Yarsis (Yayasan Rumah Sakit Islam Surabaya).

SAPADARSI membantu pasien melakukan konsultasi awal dengan agent AI **dokter**, **bidan**, dan **apoteker**, dilengkapi portal staff untuk monitoring dan alur persetujuan via Telegram.

> **Catatan medis:** SAPADARSI adalah asisten digital untuk triase dan konsultasi awal. Bukan pengganti diagnosis atau resep resmi dokter. Keputusan klinis tetap menjadi tanggung jawab tenaga medis.

---

## Ekosistem DARSI (korelasi proyek)

SAPADARSI adalah **aplikasi web utama** untuk konsultasi multi-peran. Bersama Sapabidan dan WebView, ketiganya membentuk satu ekosistem:

```text
                    ┌─────────────────────┐
                    │   darsi-webview     │  Flutter (shell native)
                    │  sapadarsi_app  ────┼──► memuat URL SAPADARSI
                    │  sapabidan_app  ────┼──► memuat URL SAPABIDAN
                    └─────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   ┌──────────────────┐            ┌──────────────────┐
   │    sapadarsi     │            │    sapabidan     │
   │  Web :3030       │            │  Web :3031       │
   │  dokter · bidan  │            │  bidan saja      │
   │  · apoteker      │            │                  │
   └──────────────────┘            └──────────────────┘
```

| Repo | Peran | Port / app |
|------|-------|------------|
| **[sapadarsi](https://github.com/mohfadhli27/sapadarsi)** (repo ini) | Web konsultasi **dokter, bidan, apoteker** | `:3030` |
| **[sapabidan](https://github.com/mohfadhli27/sapabidan)** | Web konsultasi **bidan saja** | `:3031` |
| **[darsi-webview](https://github.com/mohfadhli27/darsi-webview)** | Flutter WebView untuk kedua web di atas | `sapadarsi_app` / `sapabidan_app` |

---

## Fitur Utama

| Modul | Deskripsi |
|-------|-----------|
| Konsultasi Dokter | Triase keluhan, pemilihan dokter spesialis, wawancara klinis, ringkasan & resep digital |
| Konsultasi Bidan | Konsultasi kehamilan, kesehatan ibu, dan tumbuh kembang anak |
| Konsultasi Apoteker | Screening obat, dosis, interaksi, dan saran penggunaan |
| Portal Staff | Monitor sesi live, notifikasi, dan takeover konsultasi |
| Portal Admin | Manajemen akun staff dan sinkronisasi direktori dokter RSI |
| Telegram Approval | Notifikasi grup Telegram untuk persetujuan konsultasi |

---

## Tech Stack

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| **Language** | TypeScript | Type-safe di seluruh codebase |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) | SSR/SSG, API Routes, middleware |
| **UI** | React 19, Tailwind CSS 4, Radix UI, Framer Motion | Komponen aksesibel + animasi |
| **Form & validasi** | React Hook Form, Zod | Validasi input pasien & staff |
| **State** | Zustand | State chat, auth, sesi konsultasi |
| **Database** | PostgreSQL + `pg` | Akun, sesi konsultasi, resep, staff |
| **AI / LLM** | Ollama / vLLM (OpenAI-compatible) | Orchestrator konsultasi dokter/bidan/apoteker |
| **Dokumen** | `pdf-lib`, `pdf-parse` | Generate & baca PDF resep/ringkasan |
| **Integrasi** | API RSI Surabaya, Telegram Bot API | Direktori dokter + approval |
| **Runtime** | Node.js ≥ 20, npm ≥ 10 | Wajib untuk development & production |
| **Process manager** | PM2 (opsional) | Deploy produksi |

**Port default:** `3030`

---

## Arsitektur (ringkas)

```text
Pasien / Staff  →  SAPADARSI (Next.js :3030)
                        ├── PostgreSQL
                        ├── LLM (Ollama / vLLM)
                        ├── API RSI Surabaya
                        └── Telegram Bot
```

1. Pasien memulai sesi → agent AI mewawancarai (*gathering* → *assessment* → *closing*).
2. Respons divalidasi agar tidak mengulang pertanyaan generik.
3. Jika diperlukan, notifikasi persetujuan dikirim ke grup Telegram.
4. Staff memantau sesi; tenaga medis dapat *takeover* bila perlu.

---

## Prasyarat

Pastikan terpasang sebelum instalasi:

| Komponen | Versi / catatan | Wajib? |
|----------|-----------------|--------|
| Node.js | ≥ 20 (`node -v`) | Ya |
| npm | ≥ 10 (`npm -v`) | Ya |
| PostgreSQL | Database siap (contoh: `hospital_cs`) | Ya (untuk fitur penuh) |
| Git | Untuk clone repo | Ya |
| Ollama / LLM endpoint | Chat & model klinis | Opsional (tanpa ini AI terbatas) |
| Telegram Bot | BotFather + chat ID grup | Opsional (tanpa ini approval manual di portal) |

---

## Instalasi (langkah demi langkah)

### 1. Clone & masuk folder

```bash
git clone https://github.com/mohfadhli27/sapadarsi.git
cd sapadarsi
```

### 2. Install dependensi

```bash
npm install
```

### 3. Siapkan environment

```bash
cp .env.example .env.local
```

Edit `.env.local` — minimal isi:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/hospital_cs
JWT_SECRET=ganti-dengan-secret-yang-kuat
NEXT_PUBLIC_APP_VARIANT=sapadarsi
NEXT_PUBLIC_PUBLIC_BASE_URL=http://localhost:3030
DARSI_PUBLIC_URL=http://localhost:3030
```

Untuk AI lokal (contoh Ollama):

```env
OLLAMA_HOST=http://127.0.0.1:11434
LLM_PROFILE=ollama-local-8b
CHAT_API_BASE_URL=http://127.0.0.1:11434/v1
CHAT_MODEL=llama3.1:8b
```

> **Jangan commit** `.env.local`. Template aman ada di `.env.example`.

### 4. (Opsional) Migrasi database

Jika database masih kosong:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/hospital_cs"

psql "$DATABASE_URL" -f scripts/migrate-patient-accounts.sql
psql "$DATABASE_URL" -f scripts/migrate-doctor-consultation.sql
psql "$DATABASE_URL" -f scripts/migrate-consultation-phase.sql
psql "$DATABASE_URL" -f scripts/migrate-prescription.sql
psql "$DATABASE_URL" -f scripts/migrate-staff-portal.sql
psql "$DATABASE_URL" -f scripts/migrate-doctor-directory.sql
psql "$DATABASE_URL" -f scripts/migrate-telegram-approval-messages.sql
psql "$DATABASE_URL" -f scripts/migrate-admin-sync.sql
```

### 5. Jalankan development server

```bash
npm run dev
```

Buka: **http://localhost:3030**

### 6. Verifikasi cepat

| Cek | Cara |
|-----|------|
| App terbuka | Browser ke `http://localhost:3030` |
| Login demo | Set `NEXT_PUBLIC_DEMO_LOGIN=true` di `.env.local`, restart `npm run dev` |
| DB terhubung | Login / buat sesi konsultasi tanpa error database |
| LLM | Kirim pesan di chat; pastikan Ollama/vLLM hidup |

---

## Variabel Lingkungan

| Variabel | Wajib | Deskripsi |
|----------|-------|-----------|
| `DATABASE_URL` | Ya | Connection string PostgreSQL |
| `JWT_SECRET` | Ya | Secret verifikasi JWT |
| `NEXT_PUBLIC_APP_VARIANT` | Ya | Harus `sapadarsi` |
| `NEXT_PUBLIC_PUBLIC_BASE_URL` | Ya | Base URL publik (dev: `http://localhost:3030`) |
| `DARSI_PUBLIC_URL` | Direkomendasikan | URL di pesan Telegram |
| `OLLAMA_HOST` / `CHAT_API_BASE_URL` | Opsional | Endpoint LLM |
| `TELEGRAM_BOT_TOKEN` | Opsional | Token bot |
| `TELEGRAM_APPROVAL_GROUP_CHAT_ID` | Opsional | Chat ID grup approval |
| `NEXT_PUBLIC_DEMO_LOGIN` | Opsional | `true` = tombol login demo |

Daftar lengkap: `.env.example`.

---

## Scripts NPM

| Perintah | Deskripsi |
|----------|-----------|
| `npm run dev` | Development server di port **3030** |
| `npm run build` | Build produksi (`.next/`) |
| `npm run start` | Jalankan build produksi di port **3030** |
| `npm run lint` | ESLint |

---

## Deploy produksi (PM2)

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

Sesuaikan `cwd` di `ecosystem.config.cjs` jika path server berbeda. Pastikan `NEXT_PUBLIC_DEMO_LOGIN=false` di produksi.

---

## Struktur Proyek

```text
sapadarsi/
├── app/                 # Next.js App Router (pages + API routes)
├── src/
│   ├── components/      # UI (chat, doctor, bidan, staff, …)
│   ├── config/          # Brand, agents, routes
│   ├── hooks/           # Consultation chat, SSE, auth
│   ├── lib/             # LLM, DB, Telegram, business logic
│   ├── stores/          # Zustand
│   └── types/
├── scripts/             # Migrasi & seed
├── public/              # Logo & aset statis
├── ecosystem.config.cjs # PM2
└── .env.example         # Template env (tanpa secret)
```

---

## Troubleshooting singkat

| Masalah | Solusi |
|---------|--------|
| `ECONNREFUSED` database | Cek PostgreSQL hidup & `DATABASE_URL` benar |
| Port 3030 sudah dipakai | Hentikan proses lain, atau ubah port di `package.json` |
| Chat AI tidak merespons | Cek Ollama (`ollama list`) / `OLLAMA_HOST` |
| Telegram tidak kirim | Isi `TELEGRAM_BOT_TOKEN` + `TELEGRAM_APPROVAL_GROUP_CHAT_ID` |

---

## Keamanan

- Jangan commit `.env`, `.env.local`, token, atau kredensial DB.
- Set `NEXT_PUBLIC_DEMO_LOGIN=false` di produksi.
- Pakai `JWT_SECRET` yang kuat dan unik.

---

## Lihat juga

- [SAPABIDAN](https://github.com/mohfadhli27/sapabidan) — web konsultasi bidan
- [DARSI WebView](https://github.com/mohfadhli27/darsi-webview) — Flutter shell

---

## Lisensi

© Yarsis / RSI Surabaya A. Yani. Hubungi maintainer untuk pertanyaan lisensi dan kolaborasi.
