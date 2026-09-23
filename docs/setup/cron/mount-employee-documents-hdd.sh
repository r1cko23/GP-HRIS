#!/usr/bin/env bash
# One-time: put infrequent-access 201 scans (employee-documents bucket) on HDD.
# Live Postgres + other hot paths stay on SSD. Metadata stays in directory.employee_documents.
#
# Prefer Docker-as-root (no sudo) because volumes/storage is often root-owned.
# Fallback: sudo bind-mount + fstab when Docker is unavailable.
set -euo pipefail

SSD_STORAGE="${SSD_STORAGE:-/mnt/ssd/supabase/hris/volumes/storage}"
HDD_DOCS="${HDD_DOCS:-/mnt/hdd/storage/employee-documents}"
BUCKET_DIR="${SSD_STORAGE}/employee-documents"

echo "SSD storage root: $SSD_STORAGE"
echo "HDD docs target:  $HDD_DOCS"

mkdir -p "$(dirname "$HDD_DOCS")"
mkdir -p "$HDD_DOCS"

if command -v docker >/dev/null 2>&1; then
  echo "Using Docker to place symlink (no sudo)…"
  # Symlink target must be the host absolute path so the bind-mounted
  # volumes/storage tree resolves on the host when Storage writes files.
  docker run --rm \
    -v "$SSD_STORAGE:/storage" \
    -v "$(dirname "$HDD_DOCS"):/hdd_parent" \
    alpine:3.20 \
    sh -c "
      set -e
      mkdir -p /hdd_parent/$(basename "$HDD_DOCS")
      if [ -d /storage/employee-documents ] && [ ! -L /storage/employee-documents ]; then
        echo 'Copying existing employee-documents -> HDD…'
        cp -a /storage/employee-documents/. /hdd_parent/$(basename "$HDD_DOCS")/
        rm -rf /storage/employee-documents
      fi
      ln -sfn $HDD_DOCS /storage/employee-documents
      ls -la /storage/
    "
else
  echo "Docker unavailable — trying sudo bind-mount…"
  sudo mkdir -p "$HDD_DOCS" "$SSD_STORAGE"
  if [[ -d "$BUCKET_DIR" && ! -L "$BUCKET_DIR" ]]; then
    sudo rsync -a "$BUCKET_DIR"/ "$HDD_DOCS"/
    sudo mv "$BUCKET_DIR" "${BUCKET_DIR}.ssd-bak-$(date +%Y%m%d%H%M%S)"
  fi
  sudo mkdir -p "$BUCKET_DIR"
  if ! mountpoint -q "$BUCKET_DIR"; then
    sudo mount --bind "$HDD_DOCS" "$BUCKET_DIR"
  fi
  if ! grep -Fqs "$BUCKET_DIR" /etc/fstab; then
    echo "$HDD_DOCS $BUCKET_DIR none bind 0 0" | sudo tee -a /etc/fstab >/dev/null
  fi
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx supabase-storage; then
  echo "Restarting supabase-storage…"
  docker restart supabase-storage >/dev/null
fi
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx supabase-imgproxy; then
  echo "Restarting supabase-imgproxy…"
  docker restart supabase-imgproxy >/dev/null
fi

echo "Verify:"
ls -la "$SSD_STORAGE" || true
ls -la "$HDD_DOCS" || true
readlink -f "$BUCKET_DIR" 2>/dev/null || readlink "$BUCKET_DIR" || true
echo "Done. New uploads to bucket employee-documents land on HDD ($HDD_DOCS)."
echo "Statutory numbers stay in Postgres on SSD; only scan blobs moved."
