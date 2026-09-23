#!/usr/bin/env bash
# Weekly GREENHRISMAIN dbo.Department → directory.client_departments (CSM store IDs).
# Cron: 0 6 * * 1 with CRON_TZ=Asia/Manila (see crontab.example)
set -euo pipefail

APP_DIR="${GP_HRIS_APP_DIR:-/mnt/ssd/apps/gp-hris}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
LOCK="${CRON_LOCK_DIR:-/tmp}/gp-etl-directory-departments.lock"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$LOG_DIR"

# shellcheck source=etl-env.sh
source "$SCRIPT_DIR/etl-env.sh"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) skip: previous departments ETL still running"
  exit 0
fi

cd "$APP_DIR"
load_gp_hris_env

export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/etc/ssl/gp/ca.crt}"
if [[ -n "${ETL_SUPABASE_URL:-}" ]]; then
  export NEXT_PUBLIC_SUPABASE_URL="$ETL_SUPABASE_URL"
fi

: "${SQL_HOST:?missing SQL_HOST}"
: "${NEXT_PUBLIC_SUPABASE_URL:?missing NEXT_PUBLIC_SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing SUPABASE_SERVICE_ROLE_KEY}"

echo "$(date -Is) etl:directory:departments start"
npm run etl:directory:departments
echo "$(date -Is) etl:directory:departments done"
