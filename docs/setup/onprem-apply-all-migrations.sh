#!/usr/bin/env bash
# Apply every pending SQL migration for HRIS + CSM + Client on the on-prem box.
# Idempotent files (IF NOT EXISTS) re-run cleanly; failures are logged and skipped.
#
# Usage (on 10.0.0.110):
#   sg docker -c /mnt/ssd/apps/gp-hris/docs/setup/onprem-apply-all-migrations.sh
#   sg docker -c '.../onprem-apply-all-migrations.sh hris'   # one stack
#
# Ledger: /mnt/ssd/apps-src/migrations/<stack>/.applied
# Seed: every filename already under apps-src/migrations/<stack>/ counts as applied.

set -euo pipefail

ROOT_APPS="${ROOT_APPS:-/mnt/ssd/apps}"
ROOT_LEDGER="${ROOT_LEDGER:-/mnt/ssd/apps-src/migrations}"
ONLY="${1:-}"

declare -A STACK_APP=(
  [hris]="$ROOT_APPS/gp-hris"
  [csm]="$ROOT_APPS/csm-gp"
  [client]="$ROOT_APPS/gp-client"
)
declare -A STACK_DB=(
  [hris]="supabase-db"
  [csm]="supabase-csm-db"
  [client]="supabase-client-db"
)

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

apply_stack() {
  local stack="$1"
  local app="${STACK_APP[$stack]}"
  local db="${STACK_DB[$stack]}"
  local mig_dir="$app/supabase/migrations"
  local ledger_dir="$ROOT_LEDGER/$stack"
  local applied_file="$ledger_dir/.applied"
  local log="$ROOT_LEDGER/${stack}-apply.log"
  local fail_log="$ROOT_LEDGER/${stack}-fail.log"

  if [[ ! -d "$mig_dir" ]]; then
    echo "[$stack] missing $mig_dir — skip"
    return 0
  fi
  if ! docker inspect "$db" >/dev/null 2>&1; then
    echo "[$stack] docker container $db not found — skip"
    return 0
  fi

  mkdir -p "$ledger_dir"
  touch "$applied_file" "$log" "$fail_log"

  # One-time seed: filenames already sitting in apps-src were applied historically.
  if [[ ! -s "$applied_file" ]]; then
    local f base
    for f in "$ledger_dir"/*.sql; do
      [[ -e "$f" ]] || continue
      basename "$f" >>"$applied_file"
    done
  fi
  sort -u -o "$applied_file" "$applied_file"

  local ok=0 fail=0 skip=0
  echo "=== $(ts) $stack → $db ===" | tee -a "$log"

  # Lexicographic order matches how we ship numbered + timestamp prefixes.
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    if grep -qxF "$base" "$applied_file"; then
      skip=$((skip + 1))
      continue
    fi

    echo "=== $base ===" | tee -a "$log"
    if docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <"$f" >>"$log" 2>&1; then
      echo "OK $base" | tee -a "$log"
      echo "$base" >>"$applied_file"
      cp -f "$f" "$ledger_dir/$base"
      ok=$((ok + 1))
    else
      echo "FAIL $base" | tee -a "$log" | tee -a "$fail_log"
      fail=$((fail + 1))
    fi
  done < <(find "$mig_dir" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

  sort -u -o "$applied_file" "$applied_file"
  echo "SUMMARY $stack: ok=$ok fail=$fail skipped_already=$skip" | tee -a "$log"
}

stacks=(hris csm client)
if [[ -n "$ONLY" ]]; then
  stacks=("$ONLY")
fi

for s in "${stacks[@]}"; do
  if [[ -z "${STACK_APP[$s]+x}" ]]; then
    echo "Unknown stack: $s (want hris|csm|client)" >&2
    exit 2
  fi
  apply_stack "$s"
done
