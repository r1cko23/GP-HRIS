#!/usr/bin/env bash
# Pull new GREENHRISMAIN 201s into local Directory (hris.greenpasture.com).
# Uses --new-only --apply: INSERT missing people + children; never updates existing rows.
# Only blank or Verified verificationstatus (same gate as MAIN payroll/search).
# Pending 201s are skipped until HR finishes verification in GREENHRISMAIN.
# Cron: */30 7-19 * * 1-6 with CRON_TZ=Asia/Manila (see crontab.example)
set -euo pipefail

APP_DIR="${GP_HRIS_APP_DIR:-/mnt/ssd/apps/gp-hris}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
LOCK="${CRON_LOCK_DIR:-/tmp}/gp-etl-directory-new-only.lock"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$LOG_DIR"

# shellcheck source=etl-env.sh
source "$SCRIPT_DIR/etl-env.sh"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) skip: previous new-only ETL still running"
  exit 0
fi

cd "$APP_DIR"
load_gp_hris_env
pin_etl_supabase_local

: "${SQL_HOST:?missing SQL_HOST}"
: "${SQL_USER:?missing SQL_USER}"
: "${SQL_PASSWORD:?missing SQL_PASSWORD}"
: "${SQL_DATABASE:?missing SQL_DATABASE}"
: "${NEXT_PUBLIC_SUPABASE_URL:?missing NEXT_PUBLIC_SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing SUPABASE_SERVICE_ROLE_KEY}"

echo "$(date -Is) etl:directory:new-only start (verified blank/Verified only; SQL_HOST=$SQL_HOST url=$NEXT_PUBLIC_SUPABASE_URL)"
npm run etl:directory:new-only
echo "$(date -Is) etl:directory:new-only done"
