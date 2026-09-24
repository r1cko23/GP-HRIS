#!/usr/bin/env bash
# Install/configure cloudflared for Green Pasture .ph tunnel.
# Prerequisites: tunnel already created; credentials JSON available.
# Usage:
#   sudo bash install-cloudflared.sh /path/to/TUNNEL_UUID.json
set -euo pipefail

CRED_SRC="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SECRETS_DIR=/mnt/ssd/secrets/cloudflared
CONFIG_DST=/etc/cloudflared/config.yml

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-running with sudo..."
  exec sudo bash "$0" "$@"
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Installing cloudflared..."
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(. /etc/os-release && echo "$VERSION_CODENAME") main" \
    | tee /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq
  apt-get install -y cloudflared
fi

install -d -m 750 -o root -g root "$SECRETS_DIR"
install -d -m 755 /etc/cloudflared

if [[ -n "$CRED_SRC" && -f "$CRED_SRC" ]]; then
  base="$(basename "$CRED_SRC")"
  install -m 600 "$CRED_SRC" "$SECRETS_DIR/$base"
  uuid="${base%.json}"
  sed -e "s/TUNNEL_UUID/$uuid/g" "$SCRIPT_DIR/config.yml.example" >"$CONFIG_DST"
  chmod 600 "$CONFIG_DST"
  echo "[ok] Wrote $CONFIG_DST for tunnel $uuid"
else
  if [[ ! -f "$CONFIG_DST" ]]; then
    install -m 600 "$SCRIPT_DIR/config.yml.example" "$CONFIG_DST"
    echo "[!] Edit $CONFIG_DST — set tunnel UUID and credentials-file, then re-run."
    echo "    Create tunnel: cloudflared tunnel login && cloudflared tunnel create gp-hris-onprem"
  fi
fi

# Prefer config file over one-shot token install
if [[ -f /etc/systemd/system/cloudflared.service ]] || systemctl list-unit-files | grep -q '^cloudflared'; then
  systemctl enable cloudflared
  systemctl restart cloudflared || true
  systemctl --no-pager -l status cloudflared || true
else
  cloudflared service install 2>/dev/null || true
  systemctl enable cloudflared 2>/dev/null || true
  systemctl restart cloudflared 2>/dev/null || true
  echo "[ok] cloudflared installed. Ensure config.yml is valid, then: systemctl restart cloudflared"
fi

echo ""
echo "Next: Cloudflare DNS CNAMEs + Access apps — see README.md"
