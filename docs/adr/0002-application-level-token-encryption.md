# Application-level encryption for the Todoist token, not pgcrypto

Resolved during issue #6's grilling (DB schema design, 2026-09-04), part of the MVP wayfinder map (#4). `docs/plan.md` §9 already required the Todoist personal API token to be stored server-side, not client-visible after entry; this session settled that it's also stored **encrypted**, and how.

Encryption/decryption happens in application code — Node's built-in `crypto`, AES-256-GCM, a random IV per write — not in Postgres via the `pgcrypto` extension. The symmetric key lives in a `TOKEN_ENCRYPTION_KEY` environment variable, deployed the same way as the project's other secrets (`OPENROUTER_API_KEY` — see `docs/research.md` §2/§3), not in Supabase Vault or a separate KMS. The column (`user.todoistToken`, a Better Auth `additionalFields` column on the unified schema from ADR-0001) stores `base64(iv || authTag || ciphertext)` as `text`; decryption happens only server-side, at the point of calling the Todoist API — the value never reaches the client.

This is the same instinct as ADR-0001 (Better Auth over Supabase Auth's RLS): keep security-relevant logic in application code rather than coupling it to a Supabase-specific extension, and avoid standing up key-management infrastructure this project doesn't otherwise need for an 8-day MVP timeline.
