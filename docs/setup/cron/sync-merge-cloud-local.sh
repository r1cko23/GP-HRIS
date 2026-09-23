#!/usr/bin/env bash
# Bidirectional insert-only merge: cloud Supabase (.ph) ↔ on-prem (.com).
# Inserts rows missing by primary key on each side. Never updates/overwrites.
# Deletes do not propagate. Storage blobs are not synced.
#
# Install:
#   cp docs/setup/cron/sync-merge-cloud-local.sh ~/bin/ && chmod +x ~/bin/sync-merge-cloud-local.sh
#   # fill /mnt/ssd/secrets/cloud-sync.env (see cloud-sync.env.example)
# Cron: see crontab.example
#
# Flags in cloud-sync.env:
#   MERGE_SYNC_ENABLED=1
#   DRY_RUN=1                    # counts only (default for first rollouts)
#   MERGE_CLOUD_TO_LOCAL=1
#   MERGE_LOCAL_TO_CLOUD=0       # enable after reviewing cloud→local
set -euo pipefail

ENV_FILE="${CLOUD_SYNC_ENV:-/mnt/ssd/secrets/cloud-sync.env}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
LOCK_FILE="${LOCK_FILE:-/tmp/gp-merge-sync.lock}"
WORKDIR="${MERGE_WORKDIR:-/mnt/hdd/backups/cloud-sync/merge}"

mkdir -p "$LOG_DIR" "$WORKDIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$(date -Is) FAIL missing $ENV_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [[ "${MERGE_SYNC_ENABLED:-0}" != "1" ]]; then
  echo "$(date -Is) skipped (MERGE_SYNC_ENABLED!=1)"
  exit 0
fi

DRY_RUN="${DRY_RUN:-1}"
MERGE_CLOUD_TO_LOCAL="${MERGE_CLOUD_TO_LOCAL:-1}"
MERGE_LOCAL_TO_CLOUD="${MERGE_LOCAL_TO_CLOUD:-0}"

if ! command -v docker >/dev/null 2>&1; then
  echo "$(date -Is) FAIL docker not found" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) skipped (another merge sync holds $LOCK_FILE)"
  exit 0
fi

STAMP=$(date +%Y%m%d-%H%M%S)
echo "$(date -Is) merge sync start stamp=$STAMP dry_run=$DRY_RUN cloud→local=$MERGE_CLOUD_TO_LOCAL local→cloud=$MERGE_LOCAL_TO_CLOUD"

# Escape a string for use inside a single-quoted SQL literal ('' for ').
sql_quote() {
  printf "%s" "${1//\'/\'\'}"
}

# Run psql inside a local Supabase DB container.
# - With a heredoc / piped SQL: pass no extra args (uses docker exec -i).
# - With -c / -f: stdin is closed so a while-read loop cannot steal the table list.
local_psql() {
  local container="$1"
  shift
  if [[ $# -gt 0 ]]; then
    docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q "$@" </dev/null
  else
    docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q
  fi
}

# List mergeable tables: base tables with a PRIMARY KEY in public / directory / auth(users,identities).
# Prints: schema|table
list_local_tables_sql() {
  cat <<'SQL'
SELECT n.nspname || '|' || c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND NOT c.relispartition
  AND (
    n.nspname IN ('public', 'directory')
    OR (n.nspname = 'auth' AND c.relname IN ('users', 'identities'))
  )
  AND EXISTS (
    SELECT 1 FROM pg_constraint con
    WHERE con.conrelid = c.oid AND con.contype = 'p'
  )
ORDER BY
  CASE n.nspname WHEN 'auth' THEN 0 WHEN 'public' THEN 1 WHEN 'directory' THEN 2 ELSE 3 END,
  (
    SELECT COUNT(*) FROM pg_constraint f
    WHERE f.contype = 'f' AND f.conrelid = c.oid
  ),
  c.relname;
SQL
}

# Primary-key column list for schema.table → "col1, col2" (already quote_ident'd).
pk_cols_sql() {
  local schema="$1" table="$2"
  cat <<SQL
SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY u.ord)
FROM pg_constraint con
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = u.attnum AND NOT a.attisdropped
WHERE con.conrelid = to_regclass('$(sql_quote "$schema").$(sql_quote "$table")')
  AND con.contype = 'p';
SQL
}

# All columns for INSERT SELECT * alignment check / explicit list.
all_cols_sql() {
  local schema="$1" table="$2"
  cat <<SQL
SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
FROM pg_attribute a
WHERE a.attrelid = to_regclass('$(sql_quote "$schema").$(sql_quote "$table")')
  AND a.attnum > 0 AND NOT a.attisdropped;
SQL
}

setup_fdw() {
  local container="$1" host="$2" port="$3" user="$4" pass="$5"
  local qhost quser qpass
  qhost=$(sql_quote "$host")
  quser=$(sql_quote "$user")
  qpass=$(sql_quote "$pass")

  local_psql "$container" <<SQL
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SERVER IF EXISTS gp_merge_cloud CASCADE;

CREATE SERVER gp_merge_cloud FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host '${qhost}',
    port '${port}',
    dbname 'postgres',
    sslmode 'require',
    connect_timeout '30'
  );

CREATE USER MAPPING FOR postgres SERVER gp_merge_cloud
  OPTIONS (user '${quser}', password '${qpass}');

DROP SCHEMA IF EXISTS merge_fdw_public CASCADE;
DROP SCHEMA IF EXISTS merge_fdw_directory CASCADE;
DROP SCHEMA IF EXISTS merge_fdw_auth CASCADE;
CREATE SCHEMA merge_fdw_public;
CREATE SCHEMA merge_fdw_directory;
CREATE SCHEMA merge_fdw_auth;
SQL

  # Import what exists; ignore missing remote schemas.
  local_psql "$container" <<'SQL' || true
IMPORT FOREIGN SCHEMA public FROM SERVER gp_merge_cloud INTO merge_fdw_public;
SQL
  local_psql "$container" <<'SQL' || true
IMPORT FOREIGN SCHEMA directory FROM SERVER gp_merge_cloud INTO merge_fdw_directory;
SQL
  local_psql "$container" <<'SQL' || true
IMPORT FOREIGN SCHEMA auth LIMIT TO (users, identities) FROM SERVER gp_merge_cloud INTO merge_fdw_auth;
SQL
}

teardown_fdw() {
  local container="$1"
  local_psql "$container" <<'SQL' || true
SET session_replication_role = DEFAULT;
DROP SERVER IF EXISTS gp_merge_cloud CASCADE;
DROP SCHEMA IF EXISTS merge_fdw_public CASCADE;
DROP SCHEMA IF EXISTS merge_fdw_directory CASCADE;
DROP SCHEMA IF EXISTS merge_fdw_auth CASCADE;
SQL
}

fdw_schema_for() {
  case "$1" in
    public) echo merge_fdw_public ;;
    directory) echo merge_fdw_directory ;;
    auth) echo merge_fdw_auth ;;
    *) echo "" ;;
  esac
}

# Returns 0 if foreign table exists.
foreign_table_exists() {
  local container="$1" fschema="$2" table="$3"
  local n
  n=$(local_psql "$container" -tAc \
    "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='$(sql_quote "$fschema")' AND c.relname='$(sql_quote "$table")' AND c.relkind='f';" \
    | tr -d '[:space:]')
  [[ "${n:-0}" -ge 1 ]]
}

merge_table() {
  local container="$1" schema="$2" table="$3" direction="$4"
  # direction: cloud_to_local | local_to_cloud
  local fschema pk cols src dst where_sql sql count_sql result mode_label
  fschema=$(fdw_schema_for "$schema")
  [[ -n "$fschema" ]] || return 0

  if ! foreign_table_exists "$container" "$fschema" "$table"; then
    echo "$(date -Is) skip $schema.$table (no foreign table)"
    return 0
  fi

  pk=$(local_psql "$container" -tAc "$(pk_cols_sql "$schema" "$table")" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [[ -z "$pk" ]]; then
    echo "$(date -Is) skip $schema.$table (no primary key)"
    return 0
  fi

  cols=$(local_psql "$container" -tAc "$(all_cols_sql "$schema" "$table")" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [[ -z "$cols" ]]; then
    echo "$(date -Is) skip $schema.$table (no columns)"
    return 0
  fi

  # Build PK equality: l.col1 = r.col1 AND l.col2 = r.col2 ...
  where_sql=""
  local first=1 part col
  IFS=',' read -ra parts <<<"$pk"
  for part in "${parts[@]}"; do
    col=$(echo "$part" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    # col is already quote_ident'd (e.g. "id")
    if [[ "$first" -eq 1 ]]; then
      where_sql="l.${col} = r.${col}"
      first=0
    else
      where_sql="${where_sql} AND l.${col} = r.${col}"
    fi
  done

  if [[ "$direction" == "cloud_to_local" ]]; then
    src="${fschema}.${table}"
    dst="${schema}.${table}"
    mode_label="cloud→local"
    # r = remote (cloud fdw), l = local
    count_sql="
SELECT COUNT(*) FROM ${fschema}.\"${table}\" r
WHERE NOT EXISTS (
  SELECT 1 FROM ${schema}.\"${table}\" l WHERE ${where_sql}
);"
    sql="
SET session_replication_role = replica;
WITH ins AS (
  INSERT INTO ${schema}.\"${table}\" (${cols})
  SELECT ${cols} FROM ${fschema}.\"${table}\" r
  WHERE NOT EXISTS (
    SELECT 1 FROM ${schema}.\"${table}\" l WHERE ${where_sql}
  )
  RETURNING 1
)
SELECT COUNT(*) FROM ins;
SET session_replication_role = DEFAULT;
"
  else
    src="${schema}.${table}"
    dst="${fschema}.${table}"
    mode_label="local→cloud"
    # swap aliases: r = local, l = remote for NOT EXISTS naming? keep l=local r=remote
    count_sql="
SELECT COUNT(*) FROM ${schema}.\"${table}\" l
WHERE NOT EXISTS (
  SELECT 1 FROM ${fschema}.\"${table}\" r WHERE ${where_sql}
);"
    sql="
SET session_replication_role = replica;
WITH ins AS (
  INSERT INTO ${fschema}.\"${table}\" (${cols})
  SELECT ${cols} FROM ${schema}.\"${table}\" l
  WHERE NOT EXISTS (
    SELECT 1 FROM ${fschema}.\"${table}\" r WHERE ${where_sql}
  )
  RETURNING 1
)
SELECT COUNT(*) FROM ins;
SET session_replication_role = DEFAULT;
"
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    set +e
    result=$(local_psql "$container" -tAc "$count_sql" 2>"$WORKDIR/${STAMP}-${container}-${schema}-${table}-${direction}.err")
    local ec=$?
    set -e
    result=$(echo "${result:-}" | tr -d '[:space:]')
    if [[ "$ec" -ne 0 ]]; then
      echo "$(date -Is) FAIL dry-run $mode_label $schema.$table (see $WORKDIR/${STAMP}-${container}-${schema}-${table}-${direction}.err)" >&2
      return 1
    fi
    echo "$(date -Is) dry-run $mode_label $schema.$table would_insert=${result:-0}"
    return 0
  fi

  set +e
  result=$(local_psql "$container" -tAc "$sql" 2>"$WORKDIR/${STAMP}-${container}-${schema}-${table}-${direction}.err")
  local ec=$?
  set -e
  # Last SELECT COUNT is what we want; take last non-empty line
  result=$(echo "${result:-}" | awk 'NF{line=$0} END{print line}' | tr -d '[:space:]')
  if [[ "$ec" -ne 0 ]]; then
    echo "$(date -Is) FAIL $mode_label $schema.$table (see $WORKDIR/${STAMP}-${container}-${schema}-${table}-${direction}.err)" >&2
    return 1
  fi
  echo "$(date -Is) ok $mode_label $schema.$table inserted=${result:-0}"
}

merge_stack() {
  local name="$1" container="$2" host="$3" port="$4" user="$5" pass="$6"

  if [[ -z "$host" || -z "$user" || -z "$pass" ]]; then
    echo "$(date -Is) FAIL $name missing host/user/password" >&2
    return 1
  fi

  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "$(date -Is) FAIL $name container $container not found" >&2
    return 1
  fi

  echo "$(date -Is) --- stack=$name container=$container ---"
  setup_fdw "$container" "$host" "$port" "$user" "$pass"

  local tables_file="$WORKDIR/${STAMP}-${name}-tables.txt"
  local_psql "$container" -tA -c "$(list_local_tables_sql)" >"$tables_file"

  # Multiple passes so parent rows unlock children (esp. local→cloud where remote FKs enforce).
  local passes=3
  [[ "$DRY_RUN" == "1" ]] && passes=1

  local table_count
  table_count=$(grep -c '|' "$tables_file" 2>/dev/null || echo 0)
  echo "$(date -Is) stack=$name tables=$table_count"

  local failed=0 schema table pass pass_failed
  for ((pass = 1; pass <= passes; pass++)); do
    echo "$(date -Is) stack=$name pass=$pass/$passes"
    pass_failed=0
    # FD 3: docker exec -i inside merge_table must not consume this list via stdin.
    while IFS='|' read -r schema table <&3; do
      [[ -n "${schema:-}" && -n "${table:-}" ]] || continue
      if [[ "$MERGE_CLOUD_TO_LOCAL" == "1" ]]; then
        merge_table "$container" "$schema" "$table" cloud_to_local || pass_failed=1
      fi
      if [[ "$MERGE_LOCAL_TO_CLOUD" == "1" ]]; then
        merge_table "$container" "$schema" "$table" local_to_cloud || pass_failed=1
      fi
    done 3<"$tables_file"
    failed=$pass_failed
    if [[ "$pass_failed" -eq 0 ]]; then
      break
    fi
    if [[ "$pass" -lt "$passes" ]]; then
      echo "$(date -Is) stack=$name retrying after FK/order errors (pass $pass)"
    fi
  done

  teardown_fdw "$container"
  if [[ "$failed" -ne 0 ]]; then
    echo "$(date -Is) WARN stack=$name finished with table errors" >&2
    return 1
  fi
  echo "$(date -Is) ok stack=$name"
  return 0
}

failed=0
merge_stack hris supabase-db \
  "${HRIS_PGHOST}" "${HRIS_PGPORT:-5432}" "${HRIS_PGUSER}" "${HRIS_PGPASSWORD}" \
  || failed=1
merge_stack csm supabase-csm-db \
  "${CSM_PGHOST}" "${CSM_PGPORT:-5432}" "${CSM_PGUSER}" "${CSM_PGPASSWORD}" \
  || failed=1
merge_stack client supabase-client-db \
  "${CLIENT_PGHOST}" "${CLIENT_PGPORT:-5432}" "${CLIENT_PGUSER}" "${CLIENT_PGPASSWORD}" \
  || failed=1

# Retain ~7 days of merge error/detail logs
find "$WORKDIR" -type f -mtime +7 -delete 2>/dev/null || true

if [[ "$failed" -ne 0 ]]; then
  echo "$(date -Is) merge sync finished with errors stamp=$STAMP" >&2
  exit 1
fi

echo "$(date -Is) merge sync ok stamp=$STAMP dry_run=$DRY_RUN"
