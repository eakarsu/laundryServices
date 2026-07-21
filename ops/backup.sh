#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${BACKUP_DIR:-$project_root/backups}"
mkdir -p "$output_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="${1:-$output_dir/laundry-claims-$timestamp.dump}"
temporary="${destination}.partial"

if [[ -e "$destination" || -e "$temporary" ]]; then
  echo "Refusing to overwrite existing backup: $destination" >&2
  exit 1
fi

trap 'rm -f "$temporary"' EXIT
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$temporary"
pg_restore --list "$temporary" >/dev/null
mv "$temporary" "$destination"
trap - EXIT
shasum -a 256 "$destination" > "${destination}.sha256"
echo "$destination"
