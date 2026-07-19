#!/usr/bin/env bash
# Build Sapadarsi — WAJIB pakai variant sapadarsi (dokter + bidan + apotek)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.production ]]; then
  cp .env.sapadarsi.example .env.production
fi

echo "==> Build Sapadarsi (NEXT_PUBLIC_APP_VARIANT=sapadarsi)..."
set -a
# shellcheck disable=SC1091
source .env.production
set +a

export NEXT_PUBLIC_APP_VARIANT=sapadarsi
export NEXT_PUBLIC_PUBLIC_BASE_URL="${NEXT_PUBLIC_PUBLIC_BASE_URL:-https://sapadarsi.hcm-lab.id}"
export DARSI_PUBLIC_URL="${DARSI_PUBLIC_URL:-https://sapadarsi.hcm-lab.id}"

# Webpack (bukan Turbopack) — lebih stabil lewat openresty HTTP/2 sapadarsi.hcm-lab.id
npx next build --webpack

echo "==> Selesai. Jalankan: pm2 restart darsi-frontend --update-env"
echo "    atau: pm2 reload ecosystem.config.cjs --only darsi-frontend --update-env"
