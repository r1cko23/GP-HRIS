#!/usr/bin/env bash
# Compare Postgres RPC signatures: cloud Supabase vs on-prem HRIS.
#
# Usage:
#   ./scripts/compare-rpc-cloud-onprem.sh /path/to/cloud-rpc.txt
#
# Generate cloud-rpc.txt (Supabase SQL editor or MCP execute_sql):
#   select n.nspname || '.' || p.proname || '(' ||
#     pg_get_function_identity_arguments(p.oid) || ')'
#   from pg_proc p
#   join pg_namespace n on n.oid = p.pronamespace
#   where n.nspname in ('public', 'directory')
#     and p.prokind = 'f'
#     and p.proname not like 'pg_%'
#     and p.proname not like 'uuid_%'
#   order by 1;
#
# On-prem list is fetched over SSH from gp-hris supabase-db.

set -euo pipefail

ONPREM_SSH="${ONPREM_SSH:-admin-gp@10.0.0.110}"
ONPREM_DB_CONTAINER="${ONPREM_DB_CONTAINER:-supabase-db}"

cloud_file="${1:-}"
if [[ -z "$cloud_file" || ! -f "$cloud_file" ]]; then
  echo "Usage: $0 <cloud-rpc.txt>" >&2
  exit 1
fi

onprem_file="$(mktemp)"
trap 'rm -f "$onprem_file"' EXIT

ssh -o BatchMode=yes "$ONPREM_SSH" "docker exec $ONPREM_DB_CONTAINER psql -U postgres -d postgres -At -c \"
select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'directory')
  and p.prokind = 'f'
  and p.proname not like 'pg_%'
  and p.proname not like 'uuid_%'
  and p.proname not like 'postgres_fdw_%'
order by 1;
\"" > "$onprem_file"

sort -u "$cloud_file" -o "$cloud_file"
sort -u "$onprem_file" -o "$onprem_file"

echo "Cloud signatures: $(wc -l < "$cloud_file" | tr -d ' ')"
echo "On-prem signatures: $(wc -l < "$onprem_file" | tr -d ' ')"
echo
echo "=== In cloud, missing on on-prem (migrate these) ==="
comm -23 "$cloud_file" "$onprem_file" || true
echo
echo "=== On on-prem only (do not drop) ==="
comm -13 "$cloud_file" "$onprem_file" || true
