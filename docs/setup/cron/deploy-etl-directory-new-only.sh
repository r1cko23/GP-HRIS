#!/usr/bin/env bash
# From your Mac (LAN): deploy new-201 ETL cron wrapper to gp-hris.
# Usage: docs/setup/cron/deploy-etl-directory-new-only.sh
set -euo pipefail

HOST="${GP_HRIS_HOST:-admin-gp@10.0.0.110}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

ssh -o BatchMode=yes "$HOST" 'mkdir -p /tmp/gp-etl-cron'
scp -o BatchMode=yes \
  "$ROOT/etl-directory-new-only.sh" \
  "$ROOT/etl-env.sh" \
  "$ROOT/etl-directory-departments.sh" \
  "$ROOT/crontab.example" \
  "$HOST:/tmp/gp-etl-cron/"

ssh -o BatchMode=yes "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
mkdir -p /home/admin-gp/bin /mnt/hdd/logs/cron
install -m 755 /tmp/gp-etl-cron/etl-directory-new-only.sh /home/admin-gp/bin/etl-directory-new-only.sh
install -m 755 /tmp/gp-etl-cron/etl-env.sh /home/admin-gp/bin/etl-env.sh
install -m 755 /tmp/gp-etl-cron/etl-directory-departments.sh /home/admin-gp/bin/etl-directory-departments.sh
install -m 644 /tmp/gp-etl-cron/crontab.example /home/admin-gp/bin/crontab.example
# etl-directory-new-only.sh sources etl-env.sh from its own directory
if ! grep -q 'etl-directory-new-only.sh' <(crontab -l 2>/dev/null || true); then
  echo "WARN: crontab missing etl-directory-new-only.sh — merge from ~/bin/crontab.example"
else
  echo "crontab already has etl-directory-new-only.sh"
fi
echo "Installed ETL cron wrappers. App code on /mnt/ssd/apps/gp-hris must include verified-only ETL."
head -8 /home/admin-gp/bin/etl-directory-new-only.sh
REMOTE
