#!/usr/bin/env bash
# Prepare a Mac for Green Pasture on-prem apps (hosts + trusted local CA).
# Usage:  sudo bash install-office-client.sh
# Or double-click won't work — run from Terminal with admin password.
set -euo pipefail

SERVER_IP="${GP_SERVER_IP:-10.0.0.110}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CA_PATH="${GP_CA_PATH:-$SCRIPT_DIR/greenpasture-local-ca.crt}"
HOSTS=(hris.greenpasture.com csm.greenpasture.com timekeep.greenpasture.com)
MARKER="Green Pasture on-prem"
HOSTS_FILE=/etc/hosts

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-running with sudo..."
  exec sudo env GP_SERVER_IP="$SERVER_IP" GP_CA_PATH="$CA_PATH" bash "$0" "$@"
fi

echo ""
echo "Green Pasture office client setup"
echo "  Server : $SERVER_IP"
echo "  CA     : $CA_PATH"
echo ""

if [[ ! -f "$CA_PATH" ]]; then
  echo "ERROR: CA file not found: $CA_PATH" >&2
  echo "Keep greenpasture-local-ca.crt next to this script." >&2
  exit 1
fi

# --- hosts ---
LINE="$SERVER_IP  ${HOSTS[*]}  # $MARKER"
TMP="$(mktemp)"
# Drop prior GP on-prem lines
grep -v "$MARKER" "$HOSTS_FILE" | grep -Ev '[[:space:]](hris|csm|timekeep)\.greenpasture\.com([[:space:]]|$)' >"$TMP" || true
printf '%s\n' "$LINE" >>"$TMP"
# Preserve final newline
cp "$TMP" "$HOSTS_FILE"
rm -f "$TMP"
dscacheutil -flushcache >/dev/null 2>&1 || true
killall -HUP mDNSResponder >/dev/null 2>&1 || true
echo "[ok] hosts updated"
echo "     $LINE"

# --- trust CA (System keychain) ---
# Remove prior same-label certs then add as trustRoot
security find-certificate -c "Green Pasture Local CA" -a /Library/Keychains/System.keychain 2>/dev/null \
  | awk '/keychain:/{print}' >/dev/null || true
# Delete by common name if present (best-effort)
security delete-certificate -c "Green Pasture Local CA" /Library/Keychains/System.keychain 2>/dev/null || true
security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CA_PATH"
echo "[ok] Trusted Root CA installed (System keychain)"

echo ""
echo "Done. Quit Chrome/Safari fully (Cmd+Q), then open:"
echo "  https://hris.greenpasture.com"
echo "  https://csm.greenpasture.com"
echo "  https://timekeep.greenpasture.com"
echo ""
