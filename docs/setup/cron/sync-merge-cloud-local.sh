#!/usr/bin/env bash
# Bidirectional insert-only merge: cloud Supabase (.ph) ↔ on-prem (.com).
# Inserts rows missing by primary key on each side. Never updates/overwrites.
# Deletes do not propagate. Storage blobs are not synced.
#
# Optimized path (per table):
#   1) Pull remote PK columns only into a temp table (narrow FDW scan)
#   2) Diff PKs locally against the local table (indexed)
#   3) Fetch/insert full rows only for missing PKs (FDW WHERE id = ANY)
# Generated columns are skipped (auth.users.confirmed_at, etc.).
#
# Install:
#   cp docs/setup/cron/sync-merge-cloud-local.sh ~/bin/ && chmod +x ~/bin/sync-merge-cloud-local.sh
#   # fill /mnt/ssd/secrets/cloud-sync.env (see cloud-sync.env.example)
# Cron: see crontab.example
#
# Flags in cloud-sync.env:
#   MERGE_SYNC_ENABLED=1
#   DRY_RUN=0
#   MERGE_CLOUD_TO_LOCAL=1
#   MERGE_LOCAL_TO_CLOUD=1
set -euo pipefail

ENV_FILE="${CLOUD_SYNC_ENV:-/mnt/ssd/secrets/cloud-sync.env}"
LOG_DIR="${CRON_LOG_DIR:-/mnt/hdd/logs/cron}"
LOCK_FILE="${LOCK_FILE:-/tmp/gp-merge-sync.lock}"
WORKDIR="${MERGE_WORKDIR:-/mnt/hdd/backups/cloud-sync/merge}"
# Per-table safety net (seconds). PK-diff should finish well under this.
TABLE_TIMEOUT_SEC="${TABLE_TIMEOUT_SEC:-180}"

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
MERGE_LOCAL_TO_CLOUD="${MERGE_LOCAL_TO_CLOUD:-1}"

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

# Writable (non-generated) columns for INSERT — skips confirmed_at, email on identities, etc.
writable_cols_sql() {
  local schema="$1" table="$2"
  cat <<SQL
SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
FROM pg_attribute a
WHERE a.attrelid = to_regclass('$(sql_quote "$schema").$(sql_quote "$table")')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attgenerated = '';
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
    connect_timeout '30',
    fetch_size '5000'
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

  # Import what exists; ignore missing remote schemas (CSM/client have no directory).
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

# Build "l.col = r.col AND ..." from quote_ident'd PK list.
pk_where_sql() {
  local pk="$1" alias_l="$2" alias_r="$3"
  local first=1 part col where_sql=""
  local IFS=','
  # shellcheck disable=SC2086
  set -- $pk
  for part in "$@"; do
    col=$(echo "$part" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    if [[ "$first" -eq 1 ]]; then
      where_sql="${alias_l}.${col} = ${alias_r}.${col}"
      first=0
    else
      where_sql="${where_sql} AND ${alias_l}.${col} = ${alias_r}.${col}"
    fi
  done
  printf "%s" "$where_sql"
}

# True when PK is a single column named id (common fast path with = ANY).
pk_is_single_id() {
  local pk="$1"
  [[ "$pk" == '"id"' || "$pk" == "id" ]]
}

merge_table() {
  local container="$1" schema="$2" table="$3"
  local fschema pk cols where_lr where_mr where_ml err_base ec out sql
  local do_c2l=0 do_l2c=0 c2l_pred l2c_pred
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

  cols=$(local_psql "$container" -tAc "$(writable_cols_sql "$schema" "$table")" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [[ -z "$cols" ]]; then
    echo "$(date -Is) skip $schema.$table (no writable columns)"
    return 0
  fi

  where_lr=$(pk_where_sql "$pk" "l" "r")
  where_mr=$(pk_where_sql "$pk" "m" "r")
  where_ml=$(pk_where_sql "$pk" "m" "l")
  err_base="$WORKDIR/${STAMP}-${container}-${schema}-${table}"
  [[ "$MERGE_CLOUD_TO_LOCAL" == "1" ]] && do_c2l=1
  [[ "$MERGE_LOCAL_TO_CLOUD" == "1" ]] && do_l2c=1

  if pk_is_single_id "$pk"; then
    c2l_pred="r.id IN (SELECT id FROM _gp_merge_miss_c2l)"
    l2c_pred="l.id IN (SELECT id FROM _gp_merge_miss_l2c)"
  else
    c2l_pred="EXISTS (SELECT 1 FROM _gp_merge_miss_c2l m WHERE ${where_mr})"
    l2c_pred="EXISTS (SELECT 1 FROM _gp_merge_miss_l2c m WHERE ${where_ml})"
  fi

  # One psql session so TEMP tables survive. Emits: c2l|<n> and/or l2c|<n>
  sql="SET statement_timeout = '${TABLE_TIMEOUT_SEC}s';
CREATE TEMP TABLE _gp_merge_rpk AS
  SELECT ${pk} FROM ${fschema}.\"${table}\";
CREATE INDEX ON _gp_merge_rpk (${pk});
"

  if [[ "$do_c2l" -eq 1 ]]; then
    sql+="
CREATE TEMP TABLE _gp_merge_miss_c2l AS
  SELECT r.* FROM _gp_merge_rpk r
  WHERE NOT EXISTS (
    SELECT 1 FROM ${schema}.\"${table}\" l WHERE ${where_lr}
  );
"
    if [[ "$DRY_RUN" == "1" ]]; then
      sql+="SELECT 'c2l|' || COUNT(*)::text FROM _gp_merge_miss_c2l;"
    else
      sql+="
SET session_replication_role = replica;
WITH ins AS (
  INSERT INTO ${schema}.\"${table}\" (${cols})
  SELECT ${cols} FROM ${fschema}.\"${table}\" r
  WHERE ${c2l_pred}
  ON CONFLICT DO NOTHING
  RETURNING 1
)
SELECT 'c2l|' || COUNT(*)::text FROM ins;
SET session_replication_role = DEFAULT;
"
    fi
  fi

  if [[ "$do_l2c" -eq 1 ]]; then
    sql+="
CREATE TEMP TABLE _gp_merge_miss_l2c AS
  SELECT ${pk} FROM ${schema}.\"${table}\" l
  WHERE NOT EXISTS (
    SELECT 1 FROM _gp_merge_rpk r WHERE ${where_lr}
  );
"
    if [[ "$DRY_RUN" == "1" ]]; then
      sql+="SELECT 'l2c|' || COUNT(*)::text FROM _gp_merge_miss_l2c;"
    else
      sql+="
WITH ins AS (
  INSERT INTO ${fschema}.\"${table}\" (${cols})
  SELECT ${cols} FROM ${schema}.\"${table}\" l
  WHERE ${l2c_pred}
  ON CONFLICT DO NOTHING
  RETURNING 1
)
SELECT 'l2c|' || COUNT(*)::text FROM ins;
"
    fi
  fi

  # Pipe SQL on stdin (local_psql -tA closes stdin — call docker directly).
  set +e
  out=$(printf '%s\n' "$sql" | docker exec -i "$container" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -tA 2>"${err_base}.err")
  ec=$?
  set -e

  if [[ "$ec" -ne 0 ]]; then
    echo "$(date -Is) FAIL $schema.$table (see ${err_base}.err)" >&2
    return 1
  fi

  local line tag n mode_label
  local saw=0
  while IFS= read -r line; do
    line=$(echo "$line" | tr -d '[:space:]')
    [[ -z "$line" ]] && continue
    tag="${line%%|*}"
    n="${line#*|}"
    [[ "$n" =~ ^[0-9]+$ ]] || continue
    saw=1
    if [[ "$tag" == "c2l" ]]; then
      mode_label="cloud→local"
    elif [[ "$tag" == "l2c" ]]; then
      mode_label="local→cloud"
    else
      continue
    fi
    if [[ "$DRY_RUN" == "1" ]]; then
      echo "$(date -Is) dry-run $mode_label $schema.$table would_insert=$n"
    else
      echo "$(date -Is) ok $mode_label $schema.$table inserted=$n"
    fi
  done <<<"$out"

  if [[ "$saw" -eq 0 ]]; then
    echo "$(date -Is) ok $schema.$table (no directions)"
  fi
  return 0
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
      merge_table "$container" "$schema" "$table" || pass_failed=1
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
