#!/usr/bin/env bash
# Catalog-mirror posted GREENHRISMAIN payroll into local on-prem GP-HRIS.
# Cron suggestion: after MAIN posts (e.g. 21:00 Manila weekdays).
set -euo pipefail

APP_DIR="${GP_HRIS_APP_DIR:-/mnt/ssd/apps/gp-hris}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
LOCK="${CRON_LOCK_DIR:-/tmp}/gp-etl-posted-payroll.lock"
YEAR="${ETL_PAYROLL_YEAR:-2026}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$LOG_DIR"

# shellcheck source=etl-env.sh
source "$SCRIPT_DIR/etl-env.sh"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) skip: previous posted-payroll ETL still running"
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

echo "$(date -Is) etl:posted-payroll start (year=$YEAR SQL_HOST=$SQL_HOST url=$NEXT_PUBLIC_SUPABASE_URL)"
npx tsx scripts/etl-greenhrismain-posted-payroll.ts --year "$YEAR" --all --apply
echo "$(date -Is) etl:posted-payroll done"
