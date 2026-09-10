# Stack research notes

Background research done during planning (2026-08-30) to inform the decisions in `docs/plan.md`. Facts below were current as of that date — re-verify anything version- or pricing-sensitive before relying on it late in the project.

## 1. Todoist API for task creation

**Bottom line:** Use a personal API token for the whole project — zero setup, no expiry, no OAuth review needed. The API is unified under `/api/v1/` (REST v2 and the old Sync v9 have been merged/superseded). Tasks fully support parent/child sub-tasks, labels, priority, and natural-language due strings. An official Doist TypeScript SDK exists, but it's thin enough that plain `fetch` calls against REST are equally viable and arguably clearer for a grading rubric that wants visible tool-calling logic.

**Auth options:**
- **Personal API token**: generated instantly from Todoist Settings → Integrations, used as a `Bearer` header. Never expires unless manually revoked. Zero review process. This is what we're using.
- **OAuth app**: requires registering an app at developer.todoist.com (client_id/secret), a 3-step authorization-code flow, and refresh-token handling since access tokens expire after 1 hour. Scopes are coarse (`task:add`, `data:read`, `data:read_write`, `data:delete`, `project:delete`, `backups:read`). Meaningfully more plumbing for no benefit given our per-user personal-token model.
- Source: https://developer.todoist.com/api/v1/

**Task structure:**
- Fields available on task create/update: `content` (title, max 500 chars), `description`, `project_id`, `section_id`, `parent_id` (this is how sub-tasks work), `labels` (array, max 100/task), `priority` (1–4), `due_string` (natural language, parsed server-side), `due_date`/`due_datetime` (ISO 8601), `assignee_id`, `duration`+`duration_unit`.
- Sub-tasks are a first-class, flat mechanism (any task can point at any other task's `parent_id`) — good fit for our one-level project→sub-task structure.

**Rate limits:** ~1,000 requests / 15-minute window per token. Trivial to stay under for an interview-to-tasks flow.

**SDK:** Official TypeScript SDK `@doist/todoist-sdk` on npm (renamed from `@doist/todoist-api-typescript`; repo: https://github.com/Doist/todoist-sdk-typescript). Requires Node ≥20.18.1. Reasonable convenience layer, but calling REST directly from a TanStack Start server function is just as easy and keeps the LLM tool-call → HTTP call mapping transparent.

## 2. OpenRouter tool/function calling

**Bottom line:** Tool calling is **not universal** — it's per-model/per-endpoint, so check `supported_parameters` before picking a model (filter at https://openrouter.ai/models?supported_parameters=tools). Streaming + tool calls work together. Recommended: **Claude Sonnet 4.6** as primary (quality-first per our interview design), **Gemini 2.5 Flash** as a cheap swap for dev iteration.

**Uniformity / model support:**
- OpenRouter exposes an OpenAI-compatible tool-calling format uniformly at the API level, but whether a given model actually accepts `tools` depends on the model/provider.
- **Gotcha**: `openai/gpt-4o-mini`'s OpenRouter endpoint explicitly does **not** accept `tools` (https://openrouter.ai/openai/gpt-4o-mini), despite gpt-4o-mini supporting function calling on OpenAI's own API directly. Always verify per-model on OpenRouter specifically, never assume from the model's native provider docs.
- OpenRouter has an "Exacto" routing mode aimed at maximizing tool-calling accuracy (vs. "Balanced"/"Nitro" for price/speed). See https://openrouter.ai/docs/guides/features/tool-calling
- `parallel_tool_calls` (default on) controls whether the model can request multiple tool calls in one turn.

**Streaming + tools:** Confirmed supported — tool-call fragments appear in streamed delta chunks, standard OpenAI-style handling applies.

**Candidate models & pricing (per 1M tokens, as of Aug 2026):**

| Model | Input | Output | Tool calling | Notes |
|---|---|---|---|---|
| Gemini 2.5 Flash (`google/gemini-2.5-flash`) | $0.30 | $2.50 | Yes | cheap/fast dev default |
| GPT-4.1 Mini (`openai/gpt-4.1-mini`) | $0.40 | $1.60 | Yes | alt cheap option |
| GPT-4o-mini (`openai/gpt-4o-mini`) | $0.15 | $0.60 | **No** on OpenRouter | unusable for our tool-calling requirement |
| Claude Sonnet 4.6 (`anthropic/claude-sonnet-4.6`) | $3.00 | $15.00 | Yes | our primary model — 1M context |
| Open models (GLM 5.3 Flash, Qwen 3.8 Flash) | $0.05–0.15 | $0.17–0.47 | Listed as tool-capable | reliability for tool-calling less proven, verify empirically |

For our expected volume (a few hundred sessions, each ~5–15k tokens plus a handful of tool calls), total cost is realistically single-digit dollars even on Sonnet 4.6. Budget is not the binding constraint — tool-call formatting reliability is.

**Vercel AI SDK integration:** `@openrouter/ai-sdk-provider` (https://github.com/OpenRouterTeam/ai-sdk-provider) is the official/community-maintained provider, requires `ai@^7.0.0` and Node ≥22, ESM-only. Use `createOpenRouter({ apiKey })` then pass the model into `streamText()`/`generateText()` with a normal `tools: { ... }` object (Zod schemas + `execute` functions) — works cleanly through this provider, including streaming, and exposes OpenRouter's usage-accounting extension for token tracking.

## 3. TanStack Start maturity

**Bottom line:** Release Candidate — "feature-complete and its API is considered stable" per the official docs, not yet formally 1.0. Safe to build a course project on. Server functions are first-class and exactly what's needed to keep the OpenRouter key server-side. Vercel is the lowest-friction deploy target.

**Release status:** https://tanstack.com/start/latest/docs/framework/react/overview states RC stability explicitly, with 1.0 "expected relatively soon." Package version numbers (e.g. `@tanstack/react-start` in the 1.16x range) don't map to semver-1.0 the way other ecosystems do — trust the docs' explicit RC statement over the version number.

**Server functions for secret-key handling:** Yes — RPC-style functions that only ever execute server-side; the function body (including `process.env.OPENROUTER_API_KEY` usage) never ships to the browser bundle. This is our mechanism for routing OpenRouter calls. Integrates with TanStack Query's cache and TanStack Router's data loading. See https://tanstack.com/start/latest/docs/framework/react/guide/server-functions

**Deployment targets:**
- **Vercel** (our choice) — officially detected/auto-configured, full Node.js compatibility, integrated previews. https://vercel.com/docs/frameworks/full-stack/tanstack-start
- **Netlify** — official plugin `@netlify/vite-plugin-tanstack-start`; needs `netlify-cli` ≥17.31.
- **Cloudflare Workers** — official Vite plugin; not full Node.js runtime, check npm dependency compatibility before choosing this path.
- **Node.js/Docker** — plain Node server via Nitro/Rsbuild output, most "boring/reliable" for a grading demo.
- **Bun** — only supported with React 19+.

**Rough edges:** No hard evidence of specific bugs found; the main practical risk is pre-1.0 API churn. Two docs-stated caveats: (1) the Nitro Vite plugin for non-Vercel deployment "is still under active development"; (2) cross-check code samples against the live `tanstack.com/start/latest` docs rather than older blog posts, since the RC has a fast release cadence.

## 4. Supabase + Better Auth + TanStack Start integration notes

Added during implementation (2026-09-04), once Better Auth and the Supabase connection were actually wired up — later than, and not part of, the 2026-08-30 planning pass above.

### 4.1 Better Auth mounting & cookie-writing order

**Bottom line:** Mount Better Auth as a catch-all TanStack Start server route, and put `tanstackStartCookies()` **last** in the Better Auth plugins list.

- Better Auth's `auth.handler(request)` is wired to both `GET` and `POST` on a `/api/auth/$` catch-all route (`src/routes/api/auth/$.ts`), so every Better Auth endpoint (sign-up, sign-in, session, etc.) is reachable under `/api/auth/*`.
- The `tanstackStartCookies()` plugin must be last in the plugins list — otherwise sign-in/sign-up cookies get written as a raw `Set-Cookie` header, which TanStack Start drops instead of writing through its own response-cookie machinery.
- Read sessions server-side via `getRequestHeaders()` from `@tanstack/react-start/server`, not `request.headers` — the latter stopped working partway through TanStack Start's RC. Tracked upstream: better-auth/better-auth#6818.

### 4.2 One linear migration history for Better Auth + app tables

**Bottom line:** Generate Better Auth's tables once via `npx auth@latest generate`, then treat them as ordinary Drizzle schema from then on — never run `auth migrate` again.

- `npx auth@latest generate` writes Better Auth's tables into `src/lib/server/db/schema/auth.ts`, left structurally untouched afterward.
- That file is combined with the app's own tables (`schema/app.ts`) into one barrel (`schema/index.ts`), so both migrate through the same `drizzle-kit generate`/`migrate` history — one linear migration history instead of two competing migrators (per ADR-0001).
- Never run `auth migrate` against this schema — it's a separate migrator that fights Drizzle Kit's own migration bookkeeping.

### 4.3 Supabase's two connection strings are not interchangeable

**Bottom line:** the running app connects through the transaction-mode pooler (port 6543, `prepare: false`); migrations run against the direct connection (port 5432) instead. Mixing them up, or grabbing the wrong one during initial setup, is the most likely real-world gotcha here.

- **Transaction pooler** (`DATABASE_URL`, port 6543): what the running app (Better Auth's and Drizzle's Postgres clients) connects through. PgBouncer transaction mode doesn't support named prepared statements, so the Postgres client needs `prepare: false` (`src/lib/server/db/client.ts`).
- **Direct connection** (`MIGRATION_DATABASE_URL`, port 5432): what `drizzle-kit generate`/`migrate` and `npx auth@latest generate` run against instead. Supports prepared statements, which migrations need.
- **IPv4/IPv6 gotcha, confirmed 2026-09-04:** Supabase's direct-connection host (`db.<project>.supabase.co`) resolves to an AAAA (IPv6) record only — no A/IPv4 record. On a network with no outbound IPv6 route, `drizzle-kit migrate` fails with `ENETUNREACH`, and drizzle-kit swallows the underlying error (prints only a spinner, then exit code 1, no message). If this happens, swap `MIGRATION_DATABASE_URL` for Supabase's **Session pooler** connection string instead (Database settings → Connection string → Session pooler tab) — same IPv4-compatible reachability, and unlike the transaction pooler it still supports prepared statements. `scripts/supabase-setup.sh` already warns about this at the point where it asks for the direct connection string.
- **Shared Pooler vs. Dedicated Pooler, confirmed 2026-09-04:** Supabase's Connect dialog now offers a second, separate **Dedicated Pooler** (PgBouncer) option that also listens in transaction mode on port 6543 — easy to grab by mistake, since it sits right next to the one this project actually wants. The Dedicated Pooler is IPv6-only unless you buy the paid IPv4 add-on (Pro plan+), so picking it on a free-plan/IPv4-only network fails the same way the direct connection does. The **Shared Pooler** (Supavisor — the classic pooler this project has always used) is IPv4-native on the free plan in *both* modes, no add-on needed: use Shared Pooler → Transaction mode for `DATABASE_URL` and Shared Pooler → Session mode for `MIGRATION_DATABASE_URL`. Source: https://supabase.com/docs/guides/database/connecting-to-postgres, https://supabase.com/docs/guides/platform/ipv4-address.
  - **The dashboard shows a misleading banner here — verify with a real connection test, not the banner.** The Connect dialog's Transaction-pooler page shows an "uses IPv6 by default, enable the dedicated IPv4 address add-on" banner even while the **Shared pooler** connection string is the one displayed underneath it — the banner describes the Dedicated Pooler default, not the Shared Pooler box on the same screen. Confirmed by direct test against the Shared Pooler host (`aws-<n>-<region>.pooler.supabase.com`): `getent ahostsv4 <host>` returns real A records, and `timeout 5 bash -c 'cat < /dev/null > /dev/tcp/<ip>/6543'` (and `/5432`) both connect successfully over plain IPv4. Don't take the banner at face value — DNS/TCP-test the actual host in the box you're about to copy from.

## 5. Constructing a direct Todoist project URL

Added 2026-09-08, investigating whether Hone can link users straight to their Todoist project (stored as `todoist_project_id` per Session, created via `createProject` in `src/lib/server/todoist.ts`). Fetched the live Redoc-rendered reference at https://developer.todoist.com/api/v1/ directly (not from training-data recall) and read the actual response schemas/examples and the migration notes rendered on that page.

**Bottom line:** No `url` field exists on the project object anywhere in the current API v1 — confirmed against the literal example response JSON for both `POST /api/v1/projects` and `GET /api/v1/projects/{project_id}`. Todoist *does* document a stable, constructible web URL pattern for **tasks** (`https://app.todoist.com/app/task/<v2_id>`, after explicitly removing the old `url` field from task objects) — but never states the equivalent for projects anywhere in the docs. `https://app.todoist.com/app/project/<id>` works in practice (and matches the app's own routing plus the documented desktop `todoist://project?id={id}` scheme) but is an **unconfirmed, undocumented convention**, not a stated contract.

**(a) API response field — confirmed absent:**
- Verified against https://developer.todoist.com/api/v1/, Projects tag, the `create_project_api_v1_projects_post` and `get_project_api_v1_projects__project_id__get` operations. Both show the identical `PersonalProjectSyncView` example response, with these exact top-level fields and **no `url`**:
  `id, can_assign_tasks, can_comment, child_order, order_key, is_collapsed, color, creator_uid, created_at, is_archived, is_deleted, is_favorite, is_frozen, name, is_shared, updated_at, view_style, default_order, default_order_key, description, public_key, access, role, parent_id, inbox_project`.
- `public_key` looks tempting but isn't a "view this project" link — it belongs to the project's public-share/invite mechanism (the `Share a project` Sync endpoint), a different feature entirely.
- So `createProject` in `src/lib/server/todoist.ts` (which currently only reads `id` off the response) isn't missing a field by omission — there's nothing to read. No amount of requesting extra fields will surface a project URL from this endpoint.

**(b) Documented URL pattern — exists for tasks, not for projects:**
- The same reference has a `Migrating from v9 → General changes → Task URLs` section stating plainly: the old task object's `url` field (`https://todoist.com/showTask?id=<v1_id>`) "has been removed," and gives the replacement developers are expected to build themselves: `https://app.todoist.com/app/task/<v2_id>`.
- There is no equivalent "Project URLs" section. A full-text search of the rendered reference page for `project_url`, `projectUrl`, "Project URL", and `app.todoist.com/app/project` returns zero matches — Todoist documents the constructible pattern for tasks but never states one for projects, even though the app itself clearly uses `/app/project/<id>` routes.
- The one *officially documented* project-URL mechanism on that page is the desktop-app custom protocol (`Url schemes → Projects` section): `todoist://project?id={id}` (e.g. `todoist://project?id=128501470`). Real and documented, but it's a `todoist://` handler that opens the native desktop app (silent no-op without it installed) — not an `https://` link usable in a browser, email, or plain `<a href>`.

**Answer for Hone's purposes:** to show an "open in Todoist" link from a stored `todoist_project_id`, build `https://app.todoist.com/app/project/<id>` client-side by analogy with the officially-documented task pattern. This is the pattern to use, but flag it internally as observed-not-documented: unlike the task URL, Todoist has not committed to it in writing, so treat it as "works today" rather than a guaranteed stable contract.

**Sources (verified 2026-09-08):**
- https://developer.todoist.com/api/v1/ — Projects tag → `create_project_api_v1_projects_post` (`POST /api/v1/projects`) and `get_project_api_v1_projects__project_id__get` (`GET /api/v1/projects/{project_id}`) response schema/examples
- https://developer.todoist.com/api/v1/ — `Migrating from v9 → General changes → Task URLs` section
- https://developer.todoist.com/api/v1/ — `Url schemes → Projects` section (desktop app custom protocol)

## 6. Capping financial exposure on the shared OpenRouter key (issue #125)

Investigated 2026-09-10, ahead of production release (wayfinder map #122), to resolve issue #125: what's available to cap financial exposure on the team's own OpenRouter key once it runs server-side in production (`src/lib/server/openrouter.ts`, wired up per issue #49). The underlying worry was raised in issue #44 — "So we could just leave it up and running live" — about a shared key running against real traffic with no ceiling.

**Bottom line:** OpenRouter's own per-key credit limit is sufficient on its own for this project's scale — no app-level per-user usage limiting is needed for v1. Set a dollar credit limit (with a `daily` reset) directly on the shared key in the OpenRouter dashboard at https://openrouter.ai/settings/keys; that alone bounds worst-case spend to a number the team chooses, which is the actual risk described in #44/#125 (a handful of graders/testers hitting a live, real-money-backed key, not a multi-tenant paid product needing individual billing or abuse isolation).

**Per-key credit limits — confirmed, no extra integration needed:**
- https://openrouter.ai/docs/api-reference/limits: OpenRouter enforces two independent kinds of limit — account-wide credit balance and **individual API keys can have optional spending caps with configurable reset periods**. "If your account has a negative credit balance, you may see 402 errors, including for free models." Remaining capacity is queryable via `GET /api/v1/key` (`limit`, `limit_remaining`, `limit_reset`).
- https://openrouter.ai/docs/api-reference/api-keys/create-api-key documents the `POST /api/v1/keys` schema: creating or updating a key takes an optional `limit` field ("spending limit for the API key in USD") and `limit_reset` (`daily` | `weekly` | `monthly` | `null`), and "resets happen automatically at midnight UTC, and weeks are Monday through Sunday."
- This credit-limit field is not gated behind the Provisioning/Management API — third-party walkthroughs of the current dashboard (cross-checked against the schema above, since the dashboard itself isn't reachable by an unauthenticated docs fetch) show a plain "Credit limit" field on the standard Create/Edit Key dialog at https://openrouter.ai/settings/keys — left blank for unlimited, filled in for a hard cap. No Management key, code, or webhook wiring required to use it.

**Provisioning/Management API keys — a real capability, but not what this ticket needs:**
- https://openrouter.ai/docs/features/provisioning-api-keys: a separate class of key ("Management keys cannot be used to make API calls to OpenRouter's completion endpoints - they are exclusively for administrative operations") used to programmatically mint/rotate/monitor many per-user keys, e.g. "SaaS applications automatically creating unique API keys for each customer instance." This is OpenRouter's own answer to **per-user** quotas (one provisioned key per user, each with its own `limit`), but it means standing up a Management key plus a `/api/v1/keys` integration — real engineering aimed at multi-tenant products, not a handful of course-project graders sharing one key.
- No webhook mechanism for spend alerts is documented on any page fetched — monitoring remaining budget is poll-based (`GET /api/v1/key`), not push-based.

**Rate limits — a separate concern, and not the right lever for cost:**
- https://openrouter.ai/docs/api-reference/limits: rate limits are governed globally per account ("we govern capacity globally" — extra keys/accounts don't raise them), and the only documented hard numeric request caps are for **free** (`:free`-suffixed) models: 20 req/min always, plus 50 req/day under $10 lifetime credits or 1,000 req/day once ≥$10 has been purchased. Paid models — Hone uses `anthropic/claude-sonnet-4.6` (`DEFAULT_INTERVIEW_MODEL` in `openrouter.ts`, matching `docs/plan.md` §4) — have **no platform-level request-count cap**, only Cloudflare's generic DDoS protection ("block[ing] requests that dramatically exceed reasonable usage") and whatever the upstream provider itself enforces. So a runaway loop on a paid model burns dollars, not request-count, well before any rate-limit-shaped guard would trip — the credit limit, not the rate limit, is the correct lever here.

**Per-app attribution (`HTTP-Referer`/`X-Title`) — visibility, not a control:**
- https://openrouter.ai/docs/app-attribution: `HTTP-Referer` is "the primary identifier for rankings" and "required for app attribution. Without it, no app page will be created and your usage will not appear in rankings"; `X-Title`/`X-OpenRouter-Title` sets the display name and only matters paired with `HTTP-Referer`. These headers unlock analytics at `openrouter.ai/apps?url=<app-url>` (usage trends, token breakdowns) and leaderboard listing — pure observability, no spend-limiting or rate-limiting behavior attaches to them. Not currently sent by `createOpenRouterClient`; worth adding later for visibility, but irrelevant to capping exposure.

**What the repo currently does (`src/lib/server/openrouter.ts`):** `createOpenRouterClient` is a thin fetch wrapper — one `POST` to `https://openrouter.ai/api/v1/chat/completions` per `.complete()` call, `Authorization: Bearer <apiKey>`, no `HTTP-Referer`/`X-Title` headers, and no rate limiting or usage/cost tracking on the app side at all. The key itself is injected by the caller (ultimately `process.env.OPENROUTER_API_KEY`, per issue #49) — today, the only thing between "live" and "unbounded" is whatever is configured on the key in the OpenRouter dashboard.

**Infra that would exist if app-level limiting were ever needed:** the app already has a real Postgres/Drizzle schema with a per-user concept in place — `src/lib/server/db/schema/auth.ts`'s `user`/`session` tables, plus `src/lib/server/db/schema/app.ts`'s `interviewSessions` (indexed on `userId`) and `messages` (indexed on `sessionId`, one row per Interview turn). The join path from a `messages` row to `interviewSessions.userId` already exists, so counting turns-per-user-per-day would need no schema change to *read* — only a small counter/threshold check added before each Interview turn. Noted for completeness; per the recommendation below, this is not needed for v1.

**Recommendation:** OpenRouter's own per-key credit limit is sufficient — do not build app-level per-user usage limiting for v1. The risk named in #44/#125 is aggregate financial exposure on one shared key over a short window with a handful of known users (graders/testers, not open internet traffic), and a dashboard-configured dollar ceiling bounds that risk completely, for free, with no code. Per-user quotas would only start to earn their cost if the key were exposed to genuinely untrusted/anonymous traffic, or the team wanted to stop one grader's usage from crowding out another's inside the shared budget — neither matches the stated concern, and a counter table plus a per-turn check is real app code (however small) to guard against a risk this project doesn't actually have. If usage ever goes properly public post-submission, the natural next step is OpenRouter's own Management-API-provisioned per-user keys (already documented above), not a hand-rolled equivalent.

**Action needed:** in the OpenRouter dashboard at https://openrouter.ai/settings/keys, edit the production key (or set at creation) with a **Credit limit** — a concrete USD ceiling the team is comfortable losing outright, sized against the volume estimate already in §2 above ("a few hundred sessions... realistically single-digit dollars even on Sonnet 4.6") plus headroom — and a **Limit reset** of `daily`, so a bad day self-heals into the next rather than the cap being a single one-shot burn for the key's whole production lifetime. This is a five-minute dashboard action, not a code change. `GET /api/v1/key` can optionally be polled later to watch remaining budget, but that's monitoring, not part of the cap itself.

**Sources (verified 2026-09-10):**
- https://openrouter.ai/docs/api-reference/limits — credit limits vs. rate limits, 402/429 semantics, free-model rate caps, global rate-limit governance, DDoS protection
- https://openrouter.ai/docs/api-reference/api-keys/create-api-key — `POST /api/v1/keys` schema: `limit` (USD spending cap) and `limit_reset` (`daily`/`weekly`/`monthly`/`null`, midnight-UTC resets)
- https://openrouter.ai/docs/features/provisioning-api-keys — Management/provisioning keys: admin-only, per-user key provisioning use case, distinct from regular keys, no webhook/spend-alert mechanism documented
- https://openrouter.ai/docs/app-attribution — `HTTP-Referer`/`X-Title` headers: app attribution and analytics, not a spend or rate control
