#!/usr/bin/env bash
# One-shot installer for merge sync (cloud .ph ↔ local .com) on gp-hris.
# Also installs the emergency overwrite script (disabled by default).
set -euo pipefail

# Never redirect .sudo-pass as stdin for the whole command — that breaks heredocs/tee.
if [[ -f /home/admin-gp/.sudo-pass ]]; then
  SUDO(){ sudo -S -p '' "$@" <<<"$(cat /home/admin-gp/.sudo-pass)"; }
elif sudo -n true 2>/dev/null; then
  SUDO(){ sudo -n "$@"; }
else
  echo "FAIL: need sudo (place password in ~/.sudo-pass chmod 600, or passwordless sudo)" >&2
  exit 1
fi

SUDO -v
SUDO apt-get update -qq
SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-client

SUDO install -d -m 750 -o admin-gp -g admin-gp /mnt/ssd/secrets
if [[ -f /tmp/cloud-sync.env.incoming ]]; then
  SUDO install -m 600 -o admin-gp -g admin-gp /tmp/cloud-sync.env.incoming /mnt/ssd/secrets/cloud-sync.env
  rm -f /tmp/cloud-sync.env.incoming
elif [[ ! -f /mnt/ssd/secrets/cloud-sync.env ]]; then
  echo "FAIL: missing /tmp/cloud-sync.env.incoming and no existing /mnt/ssd/secrets/cloud-sync.env" >&2
  exit 1
fi

install -m 755 /tmp/gp-cron-sync/sync-merge-cloud-local.sh /home/admin-gp/bin/sync-merge-cloud-local.sh
install -m 755 /tmp/gp-cron-sync/sync-cloud-to-local-OVERWRITE.sh /home/admin-gp/bin/sync-cloud-to-local-OVERWRITE.sh
install -m 644 /tmp/gp-cron-sync/crontab.example /home/admin-gp/bin/crontab.example

# Overwrite path still needs systemctl; merge path does not stop apps.
cat > /tmp/gp-cloud-sync.sudoers <<'EOF'
admin-gp ALL=(root) NOPASSWD: /bin/systemctl stop gp-hris, /bin/systemctl stop csm-gp, /bin/systemctl stop gp-client, /bin/systemctl start gp-hris, /bin/systemctl start csm-gp, /bin/systemctl start gp-client, /usr/bin/systemctl stop gp-hris, /usr/bin/systemctl stop csm-gp, /usr/bin/systemctl stop gp-client, /usr/bin/systemctl start gp-hris, /usr/bin/systemctl start csm-gp, /usr/bin/systemctl start gp-client
EOF
SUDO install -m 440 /tmp/gp-cloud-sync.sudoers /etc/sudoers.d/gp-cloud-sync
SUDO visudo -cf /etc/sudoers.d/gp-cloud-sync
rm -f /tmp/gp-cloud-sync.sudoers

mkdir -p /mnt/hdd/backups/cloud-sync /mnt/hdd/backups/cloud-sync/merge /mnt/hdd/logs/cron

TMP=$(mktemp)
crontab -l 2>/dev/null >"$TMP" || true
# Remove legacy overwrite cron line if present
grep -v 'sync-cloud-to-local\.sh' "$TMP" >"${TMP}.new" || true
mv "${TMP}.new" "$TMP"
if ! grep -q 'sync-merge-cloud-local.sh' "$TMP"; then
  printf '\n# TEMP until AS VPN/Tailscale: merge cloud (.ph) ↔ local (.com) — insert missing only.\n*/10 8-20 * * 1-6 /usr/bin/sg docker -c /home/admin-gp/bin/sync-merge-cloud-local.sh >> /mnt/hdd/logs/cron/sync-merge-cloud-local.log 2>&1\n' >>"$TMP"
  crontab "$TMP"
fi
rm -f "$TMP"

# shred temporary sudo pass if present
rm -f /home/admin-gp/.sudo-pass

echo '--- verify ---'
which psql || true
docker --version
ls -la /mnt/ssd/secrets/cloud-sync.env /home/admin-gp/bin/sync-merge-cloud-local.sh /home/admin-gp/bin/sync-cloud-to-local-OVERWRITE.sh
crontab -l | grep -E 'sync-merge|sync-cloud' || true
grep -E '^[A-Z_]+=' /mnt/ssd/secrets/cloud-sync.env | sed 's/=.*/=***/'
echo INSTALL_OK
