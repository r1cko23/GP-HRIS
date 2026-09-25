#!/usr/bin/env bash
# Configure THIS Mac to SSH to gp-hris from anywhere via Cloudflare Tunnel.
#
# Prerequisites (once, on the office server):
#   bash /mnt/ssd/apps/cloudflare-tunnel/add-ssh-to-tunnel.sh
#   Optional but recommended: Cloudflare Access app for ssh.greenpasture.ph
#
# Usage on this Mac:
#   bash docs/setup/cloudflare-tunnel/mac-setup-ssh-anywhere.sh
#   ssh gp-hris
set -euo pipefail

SSH_HOST="${GP_SSH_TUNNEL_HOST:-ssh.greenpasture.ph}"
SSH_USER="${GP_SSH_USER:-admin-gp}"
SSH_CONFIG="${HOME}/.ssh/config"
MARKER="Green Pasture gp-hris Cloudflare Tunnel"

echo "==> Ensure cloudflared on Mac"
if ! command -v cloudflared >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1 && [[ -w "$(brew --prefix 2>/dev/null)/Cellar" ]]; then
    brew install cloudflare/cloudflare/cloudflared
  else
    echo "Installing cloudflared binary to ~/bin (no brew write access)..."
    mkdir -p "${HOME}/bin"
    ARCH="$(uname -m)"
    case "$ARCH" in
      arm64|aarch64) CF_ARCH=arm64 ;;
      x86_64) CF_ARCH=amd64 ;;
      *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
    esac
    curl -fsSL -o "${HOME}/bin/cloudflared" \
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${CF_ARCH}"
    chmod +x "${HOME}/bin/cloudflared"
    export PATH="${HOME}/bin:${PATH}"
    if ! grep -q 'export PATH="$HOME/bin:' "${HOME}/.zshrc" 2>/dev/null; then
      echo 'export PATH="$HOME/bin:$PATH"' >> "${HOME}/.zshrc"
    fi
  fi
fi
command -v cloudflared
cloudflared version

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
touch "$SSH_CONFIG"
chmod 600 "$SSH_CONFIG"

# Remove prior GP tunnel block
if grep -q "$MARKER" "$SSH_CONFIG" 2>/dev/null; then
  TMP="$(mktemp)"
  awk -v m="$MARKER" '
    $0 ~ m {skip=1; next}
    skip && /^Host / {skip=0}
    skip && /^# ===/ {skip=0}
    !skip {print}
  ' "$SSH_CONFIG" >"$TMP"
  # Simpler: drop from marker through next blank-line-after-block
  python3 - <<PY
from pathlib import Path
p = Path("$SSH_CONFIG")
text = p.read_text()
marker = "$MARKER"
if marker in text:
    lines = text.splitlines(True)
    out = []
    i = 0
    while i < len(lines):
        if marker in lines[i]:
            # skip until a line that starts with "Host " after we've left the block,
            # or until "# === end GP" 
            i += 1
            while i < len(lines):
                if lines[i].startswith("# === end GP tunnel"):
                    i += 1
                    break
                if lines[i].startswith("Host ") and "gp-hris" not in lines[i]:
                    break
                # keep skipping Host gp-hris block lines
                if lines[i].startswith("Host ") and i > 0:
                    # reached next host
                    break
                i += 1
            continue
        out.append(lines[i])
        i += 1
    p.write_text("".join(out))
print("removed old block (if any)")
PY
fi

BLOCK=$(cat <<EOF

# === ${MARKER} ===
Host gp-hris
  HostName ${SSH_HOST}
  User ${SSH_USER}
  ProxyCommand cloudflared access ssh --hostname %h
  ServerAliveInterval 30
  ServerAliveCountMax 3
# === end GP tunnel ===
EOF
)

# Cleaner append via python
python3 - <<PY
from pathlib import Path
p = Path("$SSH_CONFIG")
text = p.read_text()
marker = "$MARKER"
# strip old block
import re
text = re.sub(
    r"\n?# === " + re.escape(marker) + r" ===.*?# === end GP tunnel ===\n?",
    "\n",
    text,
    flags=re.S,
)
block = """
# === ${MARKER} ===
Host gp-hris
  HostName ${SSH_HOST}
  User ${SSH_USER}
  ProxyCommand cloudflared access ssh --hostname %h
  ServerAliveInterval 30
  ServerAliveCountMax 3
# === end GP tunnel ===
"""
p.write_text(text.rstrip() + "\n" + block + "\n")
print(f"wrote {p}")
PY

echo ""
echo "[ok] SSH config ready."
echo ""
echo "First connect (browser may open for Cloudflare Access login):"
echo "  ssh gp-hris"
echo ""
echo "Then deploy fixes, e.g.:"
echo "  ssh gp-hris 'cd /mnt/ssd/apps/gp-hris && npm run build && sudo systemctl restart gp-hris'"
echo ""
echo "If Access is not set up yet, create SSH app for ${SSH_HOST} in Zero Trust"
echo "  (Allow @greenpasture.ph), or temporarily test without Access."
