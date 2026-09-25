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
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64) DEB_ARCH=amd64 ;;
    aarch64|arm64) DEB_ARCH=arm64 ;;
    *) echo "ERROR: unsupported arch $ARCH" >&2; exit 1 ;;
  esac
  TMP="$(mktemp -d)"
  # Prefer GitHub .deb — Ubuntu "resolute" (and some new codenames) are missing from pkg.cloudflare.com
  curl -fsSL -o "$TMP/cloudflared.deb" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${DEB_ARCH}.deb"
  dpkg -i "$TMP/cloudflared.deb" || apt-get install -f -y
  rm -rf "$TMP"
  cloudflared version
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
