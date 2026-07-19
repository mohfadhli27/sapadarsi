#!/usr/bin/env bash
# Pasang Nginx untuk sapabidan.labvr.unusa.ac.id → localhost:3031
# Jalankan: sudo bash scripts/setup-nginx-sapabidan.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SRC="$SCRIPT_DIR/../deploy/nginx-sapabidan.conf"
CONF_DEST="/etc/nginx/sites-available/sapabidan.conf"

cp "$CONF_SRC" "$CONF_DEST"
ln -sf "$CONF_DEST" /etc/nginx/sites-enabled/sapabidan.conf

nginx -t
systemctl reload nginx

echo ""
echo "Nginx aktif: sapabidan.labvr.unusa.ac.id → 127.0.0.1:3031"
echo "SSL (opsional): certbot --nginx -d sapabidan.labvr.unusa.ac.id"
