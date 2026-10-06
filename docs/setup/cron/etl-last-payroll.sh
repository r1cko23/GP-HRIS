#!/usr/bin/env bash
# Sync directory.last_payroll_end from GREENHRISMAIN → local on-prem.
set -euo pipefail

APP_DIR="${GP_HRIS_APP_DIR:-/mnt/ssd/apps/gp-hris}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
LOCK="${CRON_LOCK_DIR:-/tmp}/gp-etl-last-payroll.lock"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$LOG_DIR"

# shellcheck source=etl-env.sh
source "$SCRIPT_DIR/etl-env.sh"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) skip: previous last-payroll sync still running"
  exit 0
fi

cd "$APP_DIR"
load_gp_hris_env
pin_etl_supabase_local

: "${SQL_HOST:?missing SQL_HOST}"
: "${NEXT_PUBLIC_SUPABASE_URL:?missing NEXT_PUBLIC_SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing SUPABASE_SERVICE_ROLE_KEY}"

echo "$(date -Is) sync:directory:last-payroll start (SQL_HOST=$SQL_HOST url=$NEXT_PUBLIC_SUPABASE_URL)"
npm run sync:directory:last-payroll:apply
echo "$(date -Is) sync:directory:last-payroll done"
