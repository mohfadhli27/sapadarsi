#!/usr/bin/env bash
# Build & sync Sapabidan dari darsi-frontend ke sapabidan-frontend
set -euo pipefail

ROOT="/home/fadhli/darsi-customer-service"
SRC="$ROOT/darsi-frontend"
DEST="$ROOT/sapabidan-frontend"

echo "==> Sync source ke sapabidan-frontend..."
mkdir -p "$DEST"
rsync -a --delete \
  --exclude .next \
  --exclude .git \
  --exclude .env.local \
  --exclude .env.production \
  --exclude 'public/logos/unusa-logo.png' \
  --exclude 'public/logos/ibi-logo.png' \
  "$SRC/" "$DEST/"

echo "==> Set env Sapabidan..."
cp "$SRC/.env.sapabidan.example" "$DEST/.env.production"
if [[ -f "$SRC/.env.local" ]]; then
  grep -E '^(NEXT_PUBLIC_AUTH_API_URL|NEXT_PUBLIC_CHAT_API_URL|JWT_SECRET|TELEGRAM_|PHARMACY_|OLLAMA_)' "$SRC/.env.local" >> "$DEST/.env.production" 2>/dev/null || true
fi

echo "==> Pastikan node_modules tersedia..."
if [[ ! -d "$DEST/node_modules" ]] || [[ ! -f "$DEST/node_modules/.package-lock.json" ]]; then
  if [[ -d "$SRC/node_modules" ]]; then
    rsync -a "$SRC/node_modules/" "$DEST/node_modules/"
  else
    cd "$DEST" && npm install
  fi
fi

echo "==> Build Sapabidan..."
cd "$DEST"
set -a
source .env.production
set +a
npm run build

echo "==> Selesai. Jalankan: pm2 start ecosystem.config.cjs --only sapabidan"
echo "    atau: pm2 restart sapabidan"
echo "    Folder: $DEST"
