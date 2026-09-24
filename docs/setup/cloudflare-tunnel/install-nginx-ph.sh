#!/usr/bin/env bash
# Add HTTP vhosts for *.greenpasture.ph (Cloudflare Tunnel origin).
# Run on gp-hris: sudo bash install-nginx-ph.sh
set -euo pipefail

SRC="${1:-/etc/nginx/sites-available/gp-apps-ph.conf}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/gp-apps-ph.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-running with sudo..."
  exec sudo bash "$0" "$@"
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: missing $TEMPLATE" >&2
  exit 1
fi

install -m 644 "$TEMPLATE" "$SRC"
ln -sfn "$SRC" /etc/nginx/sites-enabled/gp-apps-ph.conf

nginx -t
echo "[ok] Installed $SRC — run: systemctl reload nginx"
