#!/usr/bin/env bash
#
# Wipes every row from every table in the shared Supabase database —
# the app's own (interview_sessions, messages, tasks) and Better Auth's
# generated ones (user, session, account, verification) — in FK-safe
# order, leaving the schema itself untouched. See scripts/db-wipe.sql for
# the actual TRUNCATE statements.
#
# Why this is needed and safe to do at all: per ADR-0003
# (docs/adr/0003-one-shared-supabase-project-for-now.md) there's one
# Supabase project behind local dev, every Vercel Preview, and Production,
# currently holding only shared/dev-only data — nothing worth preserving.
#
# When to run this (issue #138): ONCE, by hand, after the 2026-09-11
# oral-defense demo and before opening the dev -> main promotion PR
# (docs/team-workflow.md §5), with the team notified beforehand. Not part
# of any automated flow (CI, deploys, migrations) — this is a manual,
# rarely-run utility, like scripts/supabase-setup.sh and
# scripts/vercel-connect-deploy.sh alongside it.
#
# Usage:
#   scripts/db-wipe.sh
# Reads MIGRATION_DATABASE_URL (falling back to DATABASE_URL) from the
# environment, or from .env.local if neither is already exported — the
# same pair drizzle.config.ts reads, and the same fallback rule.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
SQL_FILE="$SCRIPT_DIR/db-wipe.sql"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but wasn't found on PATH. Install the PostgreSQL client and re-run." >&2
  exit 1
fi

# Read a KEY=VALUE line out of .env.local, same as supabase-setup.sh's
# _existing() helper — not `source`, which would execute the whole file as
# shell instead of just reading two values out of it.
_env_local() {
  [[ -f .env.local ]] || return 1
  local line; line=$(grep -E "^${1}=" .env.local | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

DB_URL="${MIGRATION_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  DB_URL="$(_env_local MIGRATION_DATABASE_URL || true)"
fi
if [[ -z "$DB_URL" ]]; then
  DB_URL="$(_env_local DATABASE_URL || true)"
fi
if [[ -z "$DB_URL" ]]; then
  echo "Neither MIGRATION_DATABASE_URL nor DATABASE_URL is set (checked the environment and .env.local)." >&2
  exit 1
fi

# Redact the password before ever printing the connection string.
REDACTED_URL=$(printf '%s' "$DB_URL" | sed -E 's#(://[^:@/]+:)[^@]+(@)#\1***\2#')

echo "This will TRUNCATE every table (app + Better Auth) at:"
echo "  $REDACTED_URL"
echo "All rows in every table are deleted. This cannot be undone."
echo
read -r -p "Type 'wipe' to continue: " CONFIRM
if [[ "$CONFIRM" != "wipe" ]]; then
  echo "Aborted — nothing was touched."
  exit 1
fi

echo
echo "Truncating..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"

echo
echo "Done. Row counts (every one should read 0):"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  SELECT 'tasks' AS table_name, count(*) FROM tasks
  UNION ALL SELECT 'messages', count(*) FROM messages
  UNION ALL SELECT 'interview_sessions', count(*) FROM interview_sessions
  UNION ALL SELECT 'session', count(*) FROM session
  UNION ALL SELECT 'account', count(*) FROM account
  UNION ALL SELECT 'verification', count(*) FROM verification
  UNION ALL SELECT 'user', count(*) FROM \"user\";
"
