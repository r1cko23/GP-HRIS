#!/usr/bin/env bash
# Pull GREENHRISMAIN updates for existing Directory people (hris.greenpasture.com).
# --new-only never updates existing rows; this job covers:
#   1) names-only          (last/first/middle)
#   2) employment-fields   (employment/contract/civil/regular dates)
#   3) pay-fields          (pay_through / gcash / bank)
# Cron: every 30m Mon–Sat 07:00–19:30 Manila (same window as new-only).
set -euo pipefail

APP_DIR="${GP_HRIS_APP_DIR:-/mnt/ssd/apps/gp-hris}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
LOCK="${CRON_LOCK_DIR:-/tmp}/gp-etl-directory-employee-updates.lock"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$LOG_DIR"

# shellcheck source=etl-env.sh
source "$SCRIPT_DIR/etl-env.sh"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) skip: previous employee-updates ETL still running"
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

echo "$(date -Is) etl:directory:employee-updates start (SQL_HOST=$SQL_HOST url=$NEXT_PUBLIC_SUPABASE_URL)"

echo "$(date -Is) names-only…"
npm run etl:directory:names-only

echo "$(date -Is) employment-fields…"
npm run etl:directory:employment-fields

echo "$(date -Is) pay-fields…"
npm run etl:directory:pay-fields

echo "$(date -Is) etl:directory:employee-updates done"
