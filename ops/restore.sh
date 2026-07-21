#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: RESTORE_DATABASE_URL=... $0 BACKUP.dump" >&2
  exit 64
fi
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required and must identify an empty target database}"
backup="$1"
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[[ -r "$backup" ]] || { echo "Backup is not readable: $backup" >&2; exit 1; }
if [[ -r "${backup}.sha256" ]]; then
  (cd "$(dirname "$backup")" && shasum -a 256 -c "$(basename "$backup").sha256")
fi
table_count="$(psql "$RESTORE_DATABASE_URL" -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
if [[ "$table_count" != "0" ]]; then
  echo "Restore target is not empty; refusing destructive restore" >&2
  exit 1
fi

pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-privileges --exit-on-error "$backup"
DATABASE_URL="$RESTORE_DATABASE_URL" npm --prefix "$project_root/backend" run migrate:status
DATABASE_URL="$RESTORE_DATABASE_URL" npm --prefix "$project_root/backend" run audit:verify
