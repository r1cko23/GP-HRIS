#!/usr/bin/env bash
# EMERGENCY ONLY — full cloud → local overwrite (pg_dump + pg_restore --clean).
# Default cron uses sync-merge-cloud-local.sh (insert-only merge). Do not schedule this.
#
# Direction: cloud wipes/replaces local. Local-only rows are destroyed.
# Enable explicitly: CLOUD_SYNC_OVERWRITE_ENABLED=1 in cloud-sync.env
set -euo pipefail

ENV_FILE="${CLOUD_SYNC_ENV:-/mnt/ssd/secrets/cloud-sync.env}"
DUMP_DIR="${DUMP_DIR:-/mnt/hdd/backups/cloud-sync}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
LOCK_FILE="${LOCK_FILE:-/tmp/gp-cloud-sync.lock}"
MIN_HRIS_BYTES="${MIN_HRIS_BYTES:-50000000}"
MIN_CSM_BYTES="${MIN_CSM_BYTES:-500000}"
MIN_CLIENT_BYTES="${MIN_CLIENT_BYTES:-500000}"

mkdir -p "$DUMP_DIR" "$LOG_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$(date -Is) FAIL missing $ENV_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

# Prefer new flag; accept legacy CLOUD_SYNC_ENABLED only if OVERWRITE flag unset and legacy=1
if [[ "${CLOUD_SYNC_OVERWRITE_ENABLED:-0}" == "1" ]]; then
  :
elif [[ "${CLOUD_SYNC_OVERWRITE_ENABLED:-}" == "0" ]]; then
  echo "$(date -Is) skipped (CLOUD_SYNC_OVERWRITE_ENABLED=0)"
  exit 0
elif [[ "${CLOUD_SYNC_ENABLED:-0}" == "1" ]]; then
  echo "$(date -Is) WARN using legacy CLOUD_SYNC_ENABLED=1 for overwrite — prefer CLOUD_SYNC_OVERWRITE_ENABLED" >&2
else
  echo "$(date -Is) skipped (CLOUD_SYNC_OVERWRITE_ENABLED!=1)"
  exit 0
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "$(date -Is) FAIL pg_dump not installed (apt install postgresql-client)" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) skipped (another sync holds $LOCK_FILE)"
  exit 0
fi

STAMP=$(date +%Y%m%d-%H%M%S)
echo "$(date -Is) cloud→local sync start stamp=$STAMP"

dump_one() {
  local name="$1" host="$2" port="$3" user="$4" pass="$5" min_bytes="$6"
  local out="$DUMP_DIR/${name}-cloud-${STAMP}.dump"
  local log="$DUMP_DIR/${name}-cloud-${STAMP}.log"
  local tmp="${out}.partial"

  if [[ -z "$host" || -z "$user" || -z "$pass" ]]; then
    echo "$(date -Is) FAIL $name missing host/user/password" >&2
    return 1
  fi

  echo "$(date -Is) dump $name → $out"
  set +e
  PGPASSWORD="$pass" pg_dump \
    "host=$host port=$port dbname=postgres user=$user sslmode=require connect_timeout=30 keepalives=1 keepalives_idle=30 keepalives_interval=10 keepalives_count=5" \
    --format=custom --no-owner --no-acl \
    -n public -n auth -n storage -n directory \
    -f "$tmp" >"$log" 2>&1
  local ec=$?
  set -e

  if [[ "$ec" -ne 0 ]] || [[ ! -f "$tmp" ]]; then
    echo "$(date -Is) FAIL dump $name exit=$ec (see $log)" >&2
    rm -f "$tmp"
    return 1
  fi

  local size
  size=$(wc -c <"$tmp" | tr -d ' ')
  if [[ "$size" -lt "$min_bytes" ]]; then
    echo "$(date -Is) FAIL dump $name too small (${size} < ${min_bytes}) — abort restore" >&2
    rm -f "$tmp"
    return 1
  fi

  mv -f "$tmp" "$out"
  ln -sfn "$(basename "$out")" "$DUMP_DIR/${name}.dump"
  echo "$(date -Is) ok dump $name ${size} bytes"
}

grant_public() {
  local container="$1"
  docker exec -i "$container" psql -U postgres -d postgres <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
SQL
}

restore_one() {
  local name="$1" container="$2" dump="$3"
  local log="$DUMP_DIR/${name}-restore-${STAMP}.log"
  local remote="/tmp/${name}-cloud.dump"

  echo "$(date -Is) restore $name → $container"
  docker cp "$dump" "${container}:${remote}"
  set +e
  docker exec "$container" pg_restore -U postgres -d postgres \
    --clean --if-exists --no-owner --no-acl \
    "$remote" >"$log" 2>&1
  local ec=$?
  set -e
  docker exec "$container" rm -f "$remote" >/dev/null 2>&1 || true

  # pg_restore often returns 1 with benign NOTICE/ERROR noise; fail hard on empty log or zero size dump already guarded.
  local errors
  errors=$(grep -c '^pg_restore: error:' "$log" 2>/dev/null || true)
  echo "$(date -Is) restore $name pg_restore_exit=$ec error_lines=$errors log=$log"
  if [[ "$errors" -gt 200 ]]; then
    echo "$(date -Is) FAIL restore $name too many errors ($errors)" >&2
    return 1
  fi
  grant_public "$container"
  echo "$(date -Is) ok restore+grants $name"
}

failed=0
dump_one hris \
  "${HRIS_PGHOST}" "${HRIS_PGPORT:-5432}" "${HRIS_PGUSER}" "${HRIS_PGPASSWORD}" \
  "$MIN_HRIS_BYTES" || failed=1
dump_one csm \
  "${CSM_PGHOST}" "${CSM_PGPORT:-5432}" "${CSM_PGUSER}" "${CSM_PGPASSWORD}" \
  "$MIN_CSM_BYTES" || failed=1
dump_one client \
  "${CLIENT_PGHOST}" "${CLIENT_PGPORT:-5432}" "${CLIENT_PGUSER}" "${CLIENT_PGPASSWORD}" \
  "$MIN_CLIENT_BYTES" || failed=1

if [[ "$failed" -ne 0 ]]; then
  echo "$(date -Is) aborting — dump failed; local DBs unchanged" >&2
  exit 1
fi

echo "$(date -Is) stopping Next apps for restore"
sudo -n systemctl stop gp-hris csm-gp gp-client || {
  echo "$(date -Is) FAIL need passwordless sudo for systemctl stop/start (see docs)" >&2
  exit 1
}

restore_failed=0
restore_one hris supabase-db "$DUMP_DIR/hris-cloud-${STAMP}.dump" || restore_failed=1
restore_one csm supabase-csm-db "$DUMP_DIR/csm-cloud-${STAMP}.dump" || restore_failed=1
restore_one client supabase-client-db "$DUMP_DIR/client-cloud-${STAMP}.dump" || restore_failed=1

if [[ -f /mnt/ssd/redis/.env ]]; then
  REDIS_PASSWORD=$(grep '^REDIS_PASSWORD=' /mnt/ssd/redis/.env | cut -d= -f2- || true)
  if [[ -n "${REDIS_PASSWORD:-}" ]]; then
    docker exec gp-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning FLUSHDB >/dev/null \
      && echo "$(date -Is) redis FLUSHDB ok" \
      || echo "$(date -Is) WARN redis flush failed" >&2
  fi
fi

echo "$(date -Is) starting Next apps"
sudo -n systemctl start gp-hris csm-gp gp-client

# Retain ~7 days of cloud sync dumps
find "$DUMP_DIR" -type f \( -name '*-cloud-*.dump' -o -name '*-cloud-*.log' -o -name '*-restore-*.log' \) -mtime +7 -delete 2>/dev/null || true

if [[ "$restore_failed" -ne 0 ]]; then
  echo "$(date -Is) sync finished with restore errors" >&2
  exit 1
fi

echo "$(date -Is) cloud→local sync ok stamp=$STAMP"
