#!/usr/bin/env bash
# Add SSH over Cloudflare Tunnel: ssh.greenpasture.ph → localhost:22 on gp-hris.
# Run ONCE on gp-hris (office LAN or already-connected session):
#   bash /mnt/ssd/apps/cloudflare-tunnel/add-ssh-to-tunnel.sh
set -euo pipefail

CFG=/etc/cloudflared/config.yml
HOST=ssh.greenpasture.ph

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-running with sudo..."
  exec sudo bash "$0" "$@"
fi

if [[ ! -f "$CFG" ]]; then
  echo "ERROR: missing $CFG — finish app tunnel first" >&2
  exit 1
fi

if grep -q "hostname: ${HOST}" "$CFG"; then
  echo "[ok] $HOST already in $CFG"
else
  python3 - <<'PY'
from pathlib import Path
p = Path("/etc/cloudflared/config.yml")
text = p.read_text()
needle = "  - service: http_status:404\n"
block = """  - hostname: ssh.greenpasture.ph
    service: ssh://127.0.0.1:22
"""
if needle not in text:
    raise SystemExit("catch-all http_status:404 not found in config.yml")
if "ssh.greenpasture.ph" in text:
    print("already present")
else:
    p.write_text(text.replace(needle, block + needle))
    print("config.yml updated")
PY
fi

# DNS CNAME (as admin-gp, not root — cloudflared uses user cert)
if [[ -n "${SUDO_USER:-}" ]]; then
  runuser -u "$SUDO_USER" -- cloudflared tunnel route dns gp-hris-onprem "$HOST" || true
else
  cloudflared tunnel route dns gp-hris-onprem "$HOST" || true
fi

systemctl restart cloudflared
systemctl --no-pager -l status cloudflared | head -15

echo ""
echo "[ok] Tunnel SSH hostname: $HOST"
echo "     On your Mac (anywhere): bash docs/setup/cloudflare-tunnel/mac-setup-ssh-anywhere.sh"
echo "     Then: ssh gp-hris"
echo ""
echo "Recommended: Zero Trust → Access → Add app → type SSH → $HOST"
echo "  Policy: Allow @greenpasture.ph (same as web apps)."
