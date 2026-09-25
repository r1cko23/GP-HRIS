#!/usr/bin/env bash
# Finish tunnel after zone Active + nginx .ph already installed.
# Run on gp-hris with: bash /mnt/ssd/apps/cloudflare-tunnel/finish-tunnel.sh
# Steps that need a browser (login) will print a URL — open it while logged into
# jericko.razal@greenpasture.ph Cloudflare account.
set -euo pipefail

DIR=/mnt/ssd/apps/cloudflare-tunnel
cd "$DIR"

echo "==> Install cloudflared (.deb)"
sudo bash ./install-cloudflared.sh
command -v cloudflared
cloudflared version

echo ""
echo "==> Login (browser). Authorize zone greenpasture.ph"
cloudflared tunnel login

echo "==> Create tunnel"
cloudflared tunnel create gp-hris-onprem || cloudflared tunnel list

CRED="$(ls -1 "$HOME/.cloudflared"/*.json 2>/dev/null | head -1 || true)"
if [[ -z "$CRED" ]]; then
  echo "ERROR: no credentials JSON in ~/.cloudflared — login/create failed" >&2
  exit 1
fi
echo "Credentials: $CRED"

echo "==> Install config + systemd"
sudo bash ./install-cloudflared.sh "$CRED"

echo "==> DNS routes (replaces Vercel for these names)"
cloudflared tunnel route dns gp-hris-onprem hris.greenpasture.ph || true
cloudflared tunnel route dns gp-hris-onprem csm.greenpasture.ph || true
cloudflared tunnel route dns gp-hris-onprem timekeep.greenpasture.ph || true

echo "==> Start cloudflared"
sudo systemctl enable --now cloudflared
sudo systemctl --no-pager -l status cloudflared || true

echo ""
echo "[ok] Tunnel up. From phone (off Wi-Fi) open https://csm.greenpasture.ph"
echo "     Expect nginx/on-prem (not server: Vercel). Then add Access apps in Zero Trust."
