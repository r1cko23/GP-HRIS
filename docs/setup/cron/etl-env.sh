#!/usr/bin/env bash
# Shared helpers for GREENHRISMAIN → local on-prem Directory ETL cron wrappers.
# Always targets local Supabase (hris.greenpasture.com / loopback). Refuses cloud.
# shellcheck shell=bash

load_env_file() {
  local file="$1"
  local override="${2:-0}"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    if [[ "${val}" == \"*\" ]]; then
      val="${val:1:${#val}-2}"
    elif [[ "${val}" == \'*\' ]]; then
      val="${val:1:${#val}-2}"
    fi
    [[ -z "$key" ]] && continue
    if [[ "$override" == "1" || -z "${!key+x}" ]]; then
      printf -v "$key" '%s' "$val"
      export "$key"
    fi
  done <"$file"
}

load_gp_hris_env() {
  load_env_file ".env"
  load_env_file ".env.local"
  # On-prem secrets must win over a laptop cloud .env.local that was copied by mistake.
  load_env_file ".env.production.local" 1
}

# Pin ETL to local Kong / app host. Cloud *.supabase.co is never used unless ETL_ALLOW_CLOUD=1.
pin_etl_supabase_local() {
  export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/etc/ssl/gp/ca.crt}"

  if [[ -n "${ETL_SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    export SUPABASE_SERVICE_ROLE_KEY="$ETL_SUPABASE_SERVICE_ROLE_KEY"
  fi

  if [[ "${ETL_ALLOW_CLOUD:-}" == "1" ]]; then
    echo "WARN: ETL_ALLOW_CLOUD=1 — allowing cloud Supabase target"
    return 0
  fi

  local url="${ETL_SUPABASE_URL:-${ETL_LOCAL_SUPABASE_URL:-https://hris.greenpasture.com}}"
  case "$url" in
    *supabase.co*|*supabase.in*)
      echo "ERROR: refusing cloud Supabase URL for GREENHRISMAIN ETL: $url" >&2
      echo "Set ETL_SUPABASE_URL=https://hris.greenpasture.com (or http://127.0.0.1:8000)." >&2
      exit 1
      ;;
  esac
  case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
    *supabase.co*|*supabase.in*)
      echo "NOTE: NEXT_PUBLIC_SUPABASE_URL is cloud — overriding to local ETL target $url"
      ;;
  esac
  export NEXT_PUBLIC_SUPABASE_URL="$url"
  export ETL_SUPABASE_URL="$url"
}
