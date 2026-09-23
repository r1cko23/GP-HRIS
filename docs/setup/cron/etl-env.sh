#!/usr/bin/env bash
# Shared helpers for GREENHRISMAIN → Directory ETL cron wrappers.
# shellcheck shell=bash

load_env_file() {
  local file="$1"
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
    if [[ -z "${!key+x}" ]]; then
      printf -v "$key" '%s' "$val"
      export "$key"
    fi
  done <"$file"
}

load_gp_hris_env() {
  load_env_file ".env.local"
  load_env_file ".env.production.local"
  load_env_file ".env"
}
