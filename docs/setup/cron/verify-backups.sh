#!/usr/bin/env bash
# Weekly smoke-check: newest dump per stack must list with pg_restore -l.
# Cron: 0 4 * * 0 (Sunday; see crontab.example)
set -euo pipefail

OUT="${BACKUP_OUT:-/mnt/hdd/backups/supabase}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
DB_CONTAINER="${VERIFY_DB_CONTAINER:-supabase-db}"
mkdir -p "$LOG_DIR"

verify_dump() {
  local file="$1"
  local remote="/tmp/gp-verify-$$.dump"
  docker cp "$file" "${DB_CONTAINER}:${remote}"
  # Always remove remote copy
  if docker exec "$DB_CONTAINER" pg_restore -l "$remote" >/dev/null; then
    docker exec "$DB_CONTAINER" rm -f "$remote"
    return 0
  fi
  docker exec "$DB_CONTAINER" rm -f "$remote" || true
  return 1
}

failed=0
for name in hris csm client; do
  latest=$(ls -1t "$OUT/${name}-"*.dump 2>/dev/null | head -1 || true)
  if [[ -z "${latest}" ]]; then
    echo "$(date -Is) FAIL no dump for $name in $OUT" >&2
    failed=1
    continue
  fi
  if ! verify_dump "$latest"; then
    echo "$(date -Is) FAIL pg_restore -l $latest" >&2
    failed=1
    continue
  fi
  size=$(wc -c <"$latest" | tr -d ' ')
  echo "$(date -Is) ok $name $(basename "$latest") (${size} bytes)"
done

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi
echo "$(date -Is) verify-backups ok"
