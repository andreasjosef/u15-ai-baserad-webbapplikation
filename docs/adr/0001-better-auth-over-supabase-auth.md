# Better Auth over Supabase Auth, unified Postgres schema

`docs/plan.md` §4 left auth as "Better Auth (or equivalent) on top of Supabase Postgres." Resolved during MVP wayfinder mapping (2026-09-03): use Better Auth, with its own tables living in the same Supabase Postgres instance as the app's tables (one schema, one migration path) — not Supabase Auth, which would instead lean on Postgres Row Level Security for authorization.

Supabase Auth + RLS is the more common pattern when a project is already on Supabase, so this is a deliberate deviation: it keeps authorization logic in application code (server functions) rather than splitting it across RLS policies and app code, and avoids coupling the auth model to Supabase specifically if the DB provider ever changed. Email+password only for MVP — no OAuth provider, since it adds config/consent-screen setup with no scoping benefit here.
