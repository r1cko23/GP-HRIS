#!/usr/bin/env bash
# Run ON gp-hris (or: ssh -t admin-gp@10.0.0.110 'bash -s' < this-file)
# Installs nginx .ph vhosts + cloudflared binary/config stub. Does NOT create the tunnel
# (needs cloudflared tunnel login in a real browser session after DNS is Active).
set -euo pipefail

DIR=/mnt/ssd/apps/cloudflare-tunnel
cd "$DIR"

echo "==> nginx .ph vhosts"
sudo bash ./install-nginx-ph.sh
sudo nginx -t
sudo systemctl reload nginx

echo "==> cloudflared package + config stub"
sudo bash ./install-cloudflared.sh

echo ""
echo "[ok] nginx .ph + cloudflared base installed."
echo ""
echo "When Cloudflare zone greenpasture.ph is Active, run:"
echo "  cloudflared tunnel login"
echo "  cloudflared tunnel create gp-hris-onprem"
echo "  # note the UUID.json path, then:"
echo "  sudo bash $DIR/install-cloudflared.sh /home/admin-gp/.cloudflared/<UUID>.json"
echo "  cloudflared tunnel route dns gp-hris-onprem hris.greenpasture.ph"
echo "  cloudflared tunnel route dns gp-hris-onprem csm.greenpasture.ph"
echo "  cloudflared tunnel route dns gp-hris-onprem timekeep.greenpasture.ph"
echo "  sudo systemctl enable --now cloudflared"
echo "  sudo systemctl status cloudflared"
