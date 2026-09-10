Audited commit: 680767ccbe8b6676a3fd2e97e2177764985729f9 (branch: dev)

# Security audit — v1 production release

Research for issue #124 (wayfinder map #122). Investigated against the `dev` branch as of 2026-09-10, commit `680767ccbe8b6676a3fd2e97e2177764985729f9`, whole-tree (not a diff).

## Context

Hone is a TanStack Start / Supabase-Postgres / Better Auth / OpenRouter app with a small real userbase. Three tradeoffs are deliberate, per the ADRs, and are not relitigated below: (1) Better Auth owns auth tables in the same schema as app tables, with authorization enforced in application code rather than Postgres RLS (ADR-0001); (2) the Todoist personal API token is encrypted at the application level with AES-256-GCM using a `TOKEN_ENCRYPTION_KEY` env var rather than pgcrypto/KMS (ADR-0002); (3) one shared Supabase Postgres project backs local dev, every Vercel Preview, and Production (ADR-0003). A fourth ADR (0004) deliberately leaves `BETTER_AUTH_URL` unset on Preview, accepting Better Auth's per-request origin-derivation fallback so every branch's preview URL works.

The codebase is small, consistently patterned, and unusually well-tested for a student project: every server function re-validates its input, every session-scoped query is filtered by `userId`/session ownership (never trusting a client-supplied id alone), IDs are UUIDs, raw errors never reach the client, and there is dedicated regression coverage for the production secret guard and the token-crypto round-trip (including tampered-ciphertext and wrong-key cases). The findings below are the real gaps found on top of that baseline — mostly around rate limiting / cost control on the shared OpenRouter key, not authorization or data-exposure bugs.

## Findings

### Critical

None found.

### High

- **No app-level rate limiting or cost control on the Interview's OpenRouter proxy — but this exact risk was already researched and deliberately mitigated at the OpenRouter-key level, not here.** `startInterview` and `sendInterviewMessage` (`src/lib/server/interview-actions.ts:176-213`) are ordinary authenticated server functions with no per-user, per-session, or global throttle. Each call runs `runInterviewTurn` (`src/lib/server/interview-turn.ts`), which can make up to `MAX_MODEL_HOPS = 3` (line 64) upstream calls to OpenRouter per turn, billed against the one shared `OPENROUTER_API_KEY` (`src/lib/server/interview-actions.ts:47-51`, `src/lib/server/openrouter.ts`). A single logged-in user (or a compromised/malicious account, scripted rather than clicking) can loop these server functions with no server-side cap on turns per minute, per day, or per session — there is no cost ceiling anywhere in the request path. The 2000-character per-message cap (`src/lib/interview-input.ts:9`) bounds the size of one call but not the number of calls.
  **Cross-reference (found after the initial pass, checking wayfinder map #122 for related decisions): issue #125 ("Research: capping exposure on the shared OpenRouter key") already investigated exactly this risk and closed with a recommendation — a dashboard-configured per-key USD spend cap with a daily reset on the OpenRouter key itself, not app-level per-user rate limiting, because rate limits don't bound spend on paid (non-`:free`) models like `anthropic/claude-sonnet-4.6` the way a dollar ceiling does. That mitigation is tracked as its own follow-up, #130 ("Configure per-key spend cap on the production OpenRouter key"), already linked as a sub-issue of map #122 and already registered as a blocker on the terminal promotion ticket #129 — but **as of this audit, #130 is still open and unchecked**, i.e. the mitigation is decided but not yet applied. This audit does not open a new ticket for this finding — #130 already exists and already gates promotion — but flags it here because until #130's dashboard config is actually done, the shared key currently has no exposure cap of any kind (app-level or OpenRouter-level), which is the actual state of the "High" risk today.

### Medium

- **Login/signup brute-force protection depends on Better Auth's default in-memory rate limiter, which is unreliable on Vercel's serverless runtime.** `src/lib/auth.ts` sets no `rateLimit` block, so Better Auth's defaults apply: `enabled: isProduction` (true on both Vercel Production and Preview, since both set `NODE_ENV=production` — confirmed in `node_modules/@better-auth/core/dist/env/env-impl.mjs:32` and documented in `docs/adr/0004-better-auth-url-unset-on-preview.md`), and — absent a `secondaryStorage` — `storage: "memory"` (`node_modules/better-auth/dist/context/create-context.mjs:169-174`). The built-in special rule for `/sign-in`, `/sign-up`, `/change-password`, `/change-email` is a real 3-requests-per-10-seconds-per-IP limit (`node_modules/better-auth/dist/api/rate-limiter/index.mjs:302-315`), but it lives in a plain in-process `Map` (`.../rate-limiter/index.mjs:6`) that is not shared across concurrent serverless function instances or preserved across cold starts. On Vercel this means the limiter is best-effort, not a hard guarantee — a distributed or persistent-enough credential-stuffing attempt against `/api/auth/sign-in` can see meaningfully more than 3 attempts per 10 seconds in practice. Combined with the unmodified 8-character Better Auth default minimum password (`node_modules/better-auth/dist/context/create-context.mjs:185`, mirrored client-side in `src/lib/auth-input.ts:11`), this is a genuine (if partial) gap in credential protection. Recommended fix: configure `secondaryStorage` (e.g. Upstash Redis, already Vercel-friendly) so the limiter is process-shared, or accept the residual risk explicitly given the userbase size.

- **No app-level rate limiting on the Todoist confirm/edit actions either.** `confirmTaskBreakdown`, `updateTaskInBreakdown`, `addTaskToBreakdown`, `removeTaskFromBreakdown` (`src/lib/server/todoist-creation-actions.ts`, `src/lib/server/interview-actions.ts:363-460`) have no throttle beyond ownership checks. Lower severity than the OpenRouter finding because Todoist calls are billed against the *user's own* decrypted token, not a shared secret, but a scripted loop could still hammer a user's own Todoist account or (more relevantly) chain into the same unthrottled OpenRouter-backed session-creation path.

### Low / hardening

- **Sign-up discloses account existence.** `toAuthResult` (`src/lib/auth-result.ts:18-23`) returns "An account with this email already exists. Try logging in instead." for a `UNPROCESSABLE_ENTITY` on sign-up, which lets an attacker enumerate registered emails. Login correctly stays generic ("Invalid email or password.", line 24-26). Minor — common UX tradeoff — but worth a conscious decision given real user emails are involved.
- **No IP-attribution config for rate limiting behind Vercel's proxy.** `advanced.ipAddress.trustedProxies`/`ipAddressHeaders` are not set in `src/lib/auth.ts`. Better Auth's `getIP` (`node_modules/@better-auth/core/dist/utils/ip.mjs:172-217`) only trusts a single-value `x-forwarded-for`; a multi-hop or malformed header falls back to one shared `no-trusted-ip` bucket for all such requests rather than per-client buckets. In Vercel's normal single-hop case this resolves correctly, but it's worth configuring explicitly for defense in depth, and because it affects the reliability of the finding above.
- **No email verification and no password-reset flow are wired.** `emailAndPassword: { enabled: true }` (`src/lib/auth.ts:28-30`) has no `requireEmailVerification` and no `sendResetPassword` callback, and no email-sending plugin exists anywhere in the codebase. Anyone can sign up with an email address they don't own (no verification challenge), and a user who forgets their password currently has no self-service recovery path at all. Not itself an increase in attack surface (there's no unauthenticated reset-email endpoint to abuse), but worth flagging as a real product/support gap that will surface as soon as the userbase grows past people who can ask a maintainer to reset their password by hand.
- **`npm audit`: 4 moderate, dev-only findings**, all transitively from `drizzle-kit`'s bundled `esbuild` (`GHSA-67mh-4wv8-2f99` — the dev server accepts cross-origin requests). This only matters while `drizzle-kit generate`/`migrate` or its dev server is running locally; it does not ship into the deployed app. Fix requires a semver-major `drizzle-kit` bump (0.18.1 per npm's suggestion is actually older than the pinned `^0.31.10` — worth revisiting the actual current advisory status/fix path rather than following npm's suggested downgrade blindly).

## Accepted tradeoffs (not findings)

- **Better Auth authorization in application code, not Postgres RLS** (ADR-0001) — confirmed consistent throughout: every server function in `src/lib/server/*-actions.ts` re-checks `auth.api.getSession` and re-scopes every query by `userId` (or by a session id already proven owned), e.g. `ownedSessionId`/`ownedTaskId`/`editableSessionId` in `src/lib/server/interview-actions.ts:54-64,327-361` and the equivalent in `src/lib/server/todoist-creation-actions.ts:22-32`. No IDOR found — see "Areas checked" below.
- **Application-level Todoist token encryption, no KMS** (ADR-0002) — implementation matches the ADR exactly: AES-256-GCM (`src/lib/server/token-crypto.ts:35`), a fresh `randomBytes(12)` IV per write (line 34, and proven distinct across calls by `token-crypto.test.ts:56-61`), the auth tag is generated and verified (`getAuthTag()`/`setAuthTag()`, lines 37 & 47), and `TOKEN_ENCRYPTION_KEY` is required at read time with a loud throw if missing/blank — no silent fallback to a default key (`token-crypto.ts:22-31`, exercised by `token-crypto.test.ts:87-94`). The stored format `base64(iv||authTag||ciphertext)` is parsed by fixed-offset `subarray` calls (`token-crypto.ts:42-44`); a truncated/malformed payload fails inside `createDecipheriv`/`setAuthTag`/`decipher.final()` rather than being silently accepted, and every call site (`todoist-settings-actions.ts`, `todoist-creation-actions.ts`) wraps decryption in a try/catch that returns one generic retryable message, never the raw error or the plaintext, to the client.
- **One shared Supabase Postgres project across dev/Preview/Production** (ADR-0003) — confirmed via `.env.example` and `scripts/supabase-setup.sh`; no per-environment isolation exists, as documented and accepted.
- **`BETTER_AUTH_URL` unset on Preview, origin derived per-request** (ADR-0004) — confirmed safe in practice: with `advanced.ipAddress`/`trustedProxyHeaders` not configured, Better Auth's `getBaseURL` falls through to `getOrigin(request.url)` (`node_modules/better-auth/dist/utils/url.mjs:74-85`), i.e. the actual connection's own origin as TanStack Start/Nitro constructs it — not an attacker-supplied header — so each preview trusting only its own real origin does not create a Host-header-spoofing CSRF hole.

## Areas checked with no issues found

- **IDOR / cross-user data access**: every read/write in `history-actions.ts`, `interview-actions.ts`, `todoist-settings-actions.ts`, `todoist-creation-actions.ts` filters by the authenticated `session.user.id`, either directly (`eq(interviewSessions.userId, ...)`) or via an ownership-checked session id before any nested lookup. Session/task ids are UUIDv4 (`schema/app.ts`), not sequential.
- **Auth-bypass routes**: every route under `_shell/` and the top-level `index`/`settings` routes call `requireAuthSession(await getSession())` in `beforeLoad`; every server function additionally re-checks `auth.api.getSession` itself server-side (defense in depth — the client-side guard alone would not have been sufficient). `src/routes/api/auth/$.ts` is the only unauthenticated route, and it's the intended Better Auth catch-all.
- **CSRF / cookie config**: not overridden anywhere in `src/lib/auth.ts`. Better Auth's defaults apply: `httpOnly: true`, `sameSite: "lax"`, `secure` true whenever the resolved base URL is `https://` (`node_modules/better-auth/dist/cookies/index.mjs:23-37`); the origin-check/CSRF middleware (`node_modules/better-auth/dist/api/middlewares/origin-check.mjs`) is active by default and not disabled (`disableCSRFCheck`/`disableOriginCheck` not set).
- **SQL injection**: no `sql\`...\`` / raw-query usage anywhere in `src/`; all queries go through Drizzle's query builder with bound parameters.
- **XSS / unsanitized rendering**: `dangerouslySetInnerHTML` is used only twice, both in `src/routes/__root.tsx` for the theme/sidebar blocking-init `<script>` tags, and both scripts (`themeInitScript`/`sidebarInitScript` in `src/lib/theme.ts` / `src/lib/sidebar.ts`) are fixed strings built only from a hardcoded `localStorage` key via `JSON.stringify` — no user or model-generated content ever reaches them. The Interview transcript and model replies render as plain React children (auto-escaped); no markdown/HTML-rendering library is used anywhere in the dependency tree.
- **Prompt-injection / model-output trust**: `create_todoist_tasks` is never offered to the model (confirmed — it doesn't appear in `interview-prompt.ts`'s tool list at all); the only real-world side effect (creating Todoist projects/tasks) is fired by `confirmTaskBreakdown`, a direct backend action gated on the user clicking confirm, which re-reads the task rows from the database rather than trusting the model's last `propose_task_breakdown` arguments directly (`src/lib/server/todoist-creation-actions.ts:111-121`). `propose_task_breakdown`'s structured arguments are re-validated server-side via `parseProposedBreakdown` before being persisted (`src/lib/server/interview-turn.ts:158-168`) — the backend does not trust the model's JSON blindly. `MAX_MODEL_HOPS = 3` bounds a single turn's tool-call chain (mitigates a runaway loop within one call, though not repeated calls — see High finding above). No injection path was found from Interview text into a raw shell/DB/HTTP call — Interview text only ever becomes a `user`-role chat message or, after passing `parseProposedBreakdown`, structured task rows.
- **Secrets in client bundle**: no `import.meta.env.VITE_*` usage anywhere in `src/`; the only `process.env` reads are `DATABASE_URL` (`src/lib/server/db/client.ts:14`) and `OPENROUTER_API_KEY` (`src/lib/server/interview-actions.ts:47`), both inside `src/lib/server/` modules that only ever run server-side, plus `TOKEN_ENCRYPTION_KEY` in `token-crypto.ts` (also server-only). `vite.config.ts` defines no custom `define`/env exposure.
- **Logging**: no `console.log`/`console.error`/`console.warn` calls anywhere in `src/` — nothing to leak a secret or token through logs.
- **Secrets in git history**: `.env`/`.env.local`/`.env.production` were never committed (`git log --all --name-only` shows only `.env.example` ever tracked); `.gitignore` covers `.env` and `.env.*` (excluding the example); `.env.local` on disk is `600`-permissioned. A history-wide grep for OpenRouter-shaped (`sk-or-v1-...`) or generic `sk-...` high-entropy tokens found nothing.
- **Debug/dev-only routes**: `src/routes/` contains only the app's real routes (`/`, `/login`, `/signup`, `/settings`, `/_shell/interview`, `/_shell/interview/$sessionId`, `/_shell/history`, `/api/auth/$`) — no seed/reset/debug endpoints.
- **Input validation at server-function boundaries**: every `createServerFn` in the codebase has a `.validator(...)` that re-parses its input server-side (never trusts the client validator alone) — `auth-input.ts`, `interview-input.ts`, `token-input.ts`, `task-input.ts` are all shared client/server parsers re-run on the server.

## npm audit output

```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {
    "@esbuild-kit/core-utils": { "severity": "moderate", "via": ["esbuild"], "fixAvailable": { "name": "drizzle-kit", "version": "0.18.1", "isSemVerMajor": true } },
    "@esbuild-kit/esm-loader": { "severity": "moderate", "via": ["@esbuild-kit/core-utils"] },
    "drizzle-kit": { "severity": "moderate", "isDirect": true, "via": ["@esbuild-kit/esm-loader"], "range": "0.19.0 - 1.0.0-beta.1-fd8bfcc" },
    "esbuild": {
      "severity": "moderate",
      "via": [{
        "title": "esbuild enables any website to send any requests to the development server and read the response",
        "url": "https://github.com/advisories/GHSA-67mh-4wv8-2f99",
        "cwe": ["CWE-346"],
        "cvss": { "score": 5.3, "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:N/A:N" },
        "range": "<=0.24.2"
      }]
    }
  },
  "metadata": {
    "vulnerabilities": { "info": 0, "low": 0, "moderate": 4, "high": 0, "critical": 0, "total": 4 },
    "dependencies": { "prod": 515, "dev": 147, "optional": 124, "peer": 29, "peerOptional": 0, "total": 763 }
  }
}
```

All 4 findings are the same dev-time `esbuild`/`drizzle-kit` chain (`drizzle-kit`'s bundled `@esbuild-kit/*` pulling a vulnerable `esbuild`). This only runs locally/in CI for `db:generate`/`db:migrate`, not in the deployed app — moderate severity, dev-only exposure.

## Sources

- `src/lib/auth.ts` — Better Auth config, `additionalFields.todoistToken` (`input: false`, `returned: false`), plugin order.
- `src/lib/server/session.ts`, `src/lib/require-auth-session.ts`, `src/lib/server/auth-actions.ts` — session read/guard/sign-in-up-out wiring.
- `src/routes/api/auth/$.ts` — Better Auth catch-all mount.
- `src/lib/server/token-crypto.ts` + `src/lib/server/token-crypto.test.ts` — AES-256-GCM implementation and its tamper/wrong-key/missing-key test coverage.
- `src/lib/server/todoist-settings-actions.ts`, `src/lib/server/todoist-creation-actions.ts`, `src/lib/server/todoist-creation.ts`, `src/lib/server/todoist.ts` — token read/decrypt path and Todoist client.
- `src/lib/server/openrouter.ts`, `src/lib/server/interview-turn.ts`, `src/lib/server/interview-prompt.ts`, `src/lib/server/interview-actions.ts`, `src/lib/interview-input.ts` — OpenRouter proxy, tool-swap loop, system prompt/tool defs, message length cap.
- `src/lib/server/history-actions.ts` — history read ownership scoping.
- `src/lib/auth-input.ts`, `src/lib/token-input.ts`, `src/lib/auth-result.ts`, `src/lib/auth-secret-guard.fixture.ts`, `src/lib/auth-secret-guard.test.ts` — password policy, error mapping, production-secret-guard regression test.
- `src/lib/server/db/schema/app.ts`, `src/lib/server/db/schema/auth.ts` — schema, cascade deletes, UUID ids, `todoistToken` column.
- `src/routes/__root.tsx`, `src/lib/theme.ts`, `src/lib/sidebar.ts` — the only `dangerouslySetInnerHTML` usages.
- `src/routes/index.tsx`, `src/routes/settings.tsx`, `src/routes/login.tsx`, `src/routes/_shell.tsx`, `src/routes/_shell/interview.tsx`, `src/routes/_shell/interview_.$sessionId.tsx`, `src/routes/_shell/history.tsx` — route guards.
- `.env.example`, `.gitignore`, `scripts/supabase-setup.sh`, `scripts/vercel-connect-deploy.sh` — env-var inventory and provisioning.
- `docs/adr/0001-...md` through `0004-...md` — the accepted-tradeoff ADRs.
- `.github/workflows/ci.yml`, `.github/workflows/discord-pr-notifications.yml` — CI secret handling.
- `node_modules/better-auth/dist/context/create-context.mjs`, `node_modules/better-auth/dist/api/rate-limiter/index.mjs`, `node_modules/better-auth/dist/api/middlewares/origin-check.mjs`, `node_modules/better-auth/dist/cookies/index.mjs`, `node_modules/better-auth/dist/auth/trusted-origins.mjs`, `node_modules/better-auth/dist/utils/url.mjs`, `node_modules/@better-auth/core/dist/utils/ip.mjs`, `node_modules/@better-auth/core/dist/env/env-impl.mjs` — Better Auth's actual pinned-version (1.7.2) default behavior for secrets, rate limiting, cookies, CSRF/origin checks, and IP resolution.
- `git log --all`, `git check-ignore -v`, `stat` — confirmed no `.env`/`.env.local` ever committed and current permissions.
- `npm audit --json` — dependency vulnerability scan (run live, output above).
