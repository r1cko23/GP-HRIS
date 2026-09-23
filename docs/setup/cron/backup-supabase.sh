#!/usr/bin/env bash
# Nightly custom-format dumps of all three local Supabase Postgres stacks → HDD.
# Install: cp to ~/bin/backup-supabase.sh && chmod +x
# Cron: 15 2 * * * (see crontab.example; prefer CRON_TZ=Asia/Manila)
set -euo pipefail

STAMP=$(date +%F)
OUT="${BACKUP_OUT:-/mnt/hdd/backups/supabase}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
mkdir -p "$OUT" "$LOG_DIR"

dump_one() {
  local name="$1"
  local container="$2"
  local dest="$OUT/${name}-${STAMP}.dump"
  local tmp="${dest}.partial"
  if ! docker exec "$container" pg_dump -U postgres -Fc postgres >"$tmp"; then
    echo "$(date -Is) FAIL dump $name ($container)" >&2
    rm -f "$tmp"
    return 1
  fi
  mv -f "$tmp" "$dest"
  local size
  size=$(wc -c <"$dest" | tr -d ' ')
  echo "$(date -Is) ok $name -> $dest (${size} bytes)"
}

failed=0
dump_one hris supabase-db || failed=1
dump_one csm supabase-csm-db || failed=1
dump_one client supabase-client-db || failed=1

find "$OUT" -type f -name '*.dump' -mtime +14 -delete

if [[ "$failed" -ne 0 ]]; then
  echo "$(date -Is) backup finished with errors" >&2
  exit 1
fi
echo "$(date -Is) backup ok hris/csm/client -> $OUT"
