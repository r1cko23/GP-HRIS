#!/usr/bin/env bash
# Print GoTrue allow-list lines for .com + .ph (paste into each stack's auth env).
# Does not restart containers — you apply env + recreate auth yourself.
set -euo pipefail

apps=(hris csm timekeep)
echo "# Add to GOTRUE_URI_ALLOW_LIST (comma-separated) or Supabase Auth redirect allow list:"
for a in "${apps[@]}"; do
  echo "https://${a}.greenpasture.com/*"
  echo "https://${a}.greenpasture.ph/*"
done
echo ""
echo "# Example single line:"
echo -n "GOTRUE_URI_ALLOW_LIST="
first=1
for a in "${apps[@]}"; do
  for tld in com ph; do
    if [[ $first -eq 1 ]]; then first=0; else echo -n ","; fi
    echo -n "https://${a}.greenpasture.${tld}/*"
  done
done
echo
