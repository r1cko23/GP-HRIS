#!/usr/bin/env bash
# Apply Cloudflare Access + Cache bypass for hris/csm/timekeep.greenpasture.ph
# Requires: /mnt/ssd/secrets/cloudflare-api.env  (see README)  OR env CLOUDFLARE_API_TOKEN
set -euo pipefail

ENV_FILE="${CLOUDFLARE_API_ENV:-/mnt/ssd/secrets/cloudflare-api.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:?Missing CLOUDFLARE_API_TOKEN — create token and $ENV_FILE}"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-aef4eab269dda056de6dd8361e9ca2ab}"
export CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-6a09c657d02428d2136f355d397dc268}"
export GP_ACCESS_EMAIL_DOMAIN="${GP_ACCESS_EMAIL_DOMAIN:-greenpasture.ph}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec python3 "$SCRIPT_DIR/apply-access-and-cache.py"
