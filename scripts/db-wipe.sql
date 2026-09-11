-- Truncates every table in the shared Supabase database — the app's own
-- (src/lib/server/db/schema/app.ts) and Better Auth's generated ones
-- (src/lib/server/db/schema/auth.ts) — leaving the schema itself intact.
-- Run via scripts/db-wipe.sh, which explains when this is safe to run.
--
-- One combined TRUNCATE, not one per table: Postgres refuses to truncate a
-- table that still has an FK reference from a table outside that same
-- TRUNCATE command, even if the referencing table was already emptied by
-- an earlier, separate statement — CASCADE or "all in one command" are the
-- only ways round it. Listing every table here (still ordered child before
-- parent for readability, though the order no longer matters to Postgres)
-- avoids needing CASCADE, so an unexpected new FK added later fails loudly
-- instead of silently wiping a table nobody listed:
--   tasks, messages           -> interview_sessions
--   interview_sessions         -> user
--   session, account           -> user
--   verification                (no FK)
TRUNCATE TABLE
  tasks,
  messages,
  interview_sessions,
  session,
  account,
  verification,
  "user";
