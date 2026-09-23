#!/usr/bin/env bash
# From your Mac (LAN): deploy merge sync scripts to gp-hris and run a dry-run.
# Usage: docs/setup/cron/deploy-merge-sync.sh
set -euo pipefail

HOST="${GP_HRIS_HOST:-admin-gp@10.0.0.110}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

ssh -o BatchMode=yes "$HOST" 'mkdir -p /tmp/gp-merge-sync'

scp -o BatchMode=yes \
  "$ROOT/sync-merge-cloud-local.sh" \
  "$ROOT/sync-cloud-to-local-OVERWRITE.sh" \
  "$ROOT/crontab.example" \
  "$HOST:/tmp/gp-merge-sync/"

ssh -o BatchMode=yes "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
mkdir -p /home/admin-gp/bin /mnt/hdd/backups/cloud-sync/merge /mnt/hdd/logs/cron
install -m 755 /tmp/gp-merge-sync/sync-merge-cloud-local.sh /home/admin-gp/bin/sync-merge-cloud-local.sh
install -m 755 /tmp/gp-merge-sync/sync-cloud-to-local-OVERWRITE.sh /home/admin-gp/bin/sync-cloud-to-local-OVERWRITE.sh
install -m 644 /tmp/gp-merge-sync/crontab.example /home/admin-gp/bin/crontab.example
echo "Installed. Running dry-run (flags from /mnt/ssd/secrets/cloud-sync.env)..."
/usr/bin/sg docker -c /home/admin-gp/bin/sync-merge-cloud-local.sh
REMOTE
