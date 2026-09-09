# Architecture

A reviewer's entry point to the codebase. This file is a map and one walked
path — it does not repeat what the code already says. Every module carries a
file-level header comment stating its intent, its originating issue, and
cross-references to `docs/plan.md`, an ADR, or `CONTEXT.md`; the design
rationale lives there and in `docs/adr/`. Read `CONTEXT.md` first for the
domain vocabulary (Interview, Session, Checkpoint, Phase, Task Breakdown) —
the code uses those terms precisely.

## What the app does

Hone turns a vague idea ("I should sort out the garage") into concrete tasks
in the user's own Todoist. A user signs up, pastes a Todoist personal API
token into settings, and starts an **Interview**: a multi-turn, one-question-
at-a-time conversation driven by a single LLM system prompt. The model
converges on what the project actually is, marks that with a `mark_checkpoint`
tool call, drills into concrete tasks, then emits a `propose_task_breakdown`
tool call. The user reviews and edits the proposed task list in a table, then
confirms — a direct backend action creates a dedicated Todoist project and
the tasks inside it.

## Stack

- **TanStack Start (RC) + React 19 + TypeScript** — one full-stack app. Server
  functions (`createServerFn`) keep secrets (OpenRouter key, encryption key,
  Todoist tokens) off the client bundle.
- **Vercel** — deploy target. `nitro({ preset: 'vercel' })` in `vite.config.ts`
  compiles the server routes into Vercel Functions (see that file's comment and
  §"Deployment gotchas" below).
- **Supabase Postgres + Drizzle ORM** — one schema, one linear migration
  history covering both the app's tables and Better Auth's generated ones
  (ADR-0001).
- **Better Auth** — email + password only. Its tables are generated once into
  `src/lib/server/db/schema/auth.ts` and then treated as ordinary Drizzle
  schema.
- **OpenRouter** — LLM gateway, hand-rolled `fetch` client (no AI SDK).
  Primary model `anthropic/claude-sonnet-4.6`, swappable via `OPENROUTER_MODEL`.
- **Todoist REST API v1** — hand-rolled `fetch` client, one per user token.

## Module map

```
src/
  routes/            TanStack Router file routes. Thin: a beforeLoad/loader
                     guard, local state, and calls into server functions.
                     index, interview, interview_.$sessionId, history,
                     login, signup, settings, api/auth/$ (Better Auth mount).
  components/         Presentational React. Rendered by routes, and directly
                     by their own tests without a router context.
  lib/               Pure, environment-free logic — validation, Phase
                     derivation, history-row shaping, route guards. Runs
                     unchanged in the browser and on the server; every file
                     has a sibling *.test.ts.
  lib/server/        Everything that touches the outside world: the DB
                     client, the LLM and Todoist clients, the interview and
                     Todoist-creation orchestrators, and the server-function
                     wiring that connects them.
  lib/server/db/     Drizzle client and schema (schema/app.ts + generated
                     schema/auth.ts, barrelled in schema/index.ts).
```

Two layers deserve attention:

- **`lib/server/interview-turn.ts` and `lib/server/todoist-creation.ts` are
  the orchestrators.** They hold the real logic (the interview loop, the
  create-then-rollback flow) behind *injected ports* — an interface of
  side-effecting functions. Their tests supply in-memory ports, so the logic
  is tested with no DB and no network.
- **`lib/server/*-actions.ts` are the wiring.** They implement those ports
  with real Drizzle queries and real HTTP clients, and expose the result as
  server functions. They are deliberately thin enough to skip their own unit
  tests — the orchestrator, the schema, and the UI each carry theirs.

## Walked path: one interview turn

The core flow, from a keystroke to a persisted turn.

1. **`src/routes/interview.tsx`** — `InterviewRoute` holds the transcript in
   local state (the conversation is single-sitting — `docs/plan.md` §13).
   `handleSubmit` calls `startInterview` on the first message, then
   `sendInterviewMessage` for each turn.
2. **`src/lib/server/interview-actions.ts`** — the server function
   authenticates via `auth.api.getSession()` (cookies work here only through
   `getRequestHeaders()` — see `src/lib/server/session.ts`), resolves the
   caller-owned Session id, builds the real ports (Drizzle + a fresh
   `createOpenRouterClient`), and calls the orchestrator. Its `catch` rolls
   back this turn's writes so a retry starts clean, and returns a retryable
   message — never a raw error (`docs/plan.md` §10).
3. **`src/lib/server/interview-turn.ts`** — `runInterviewTurn`:
   - Persists the user message immediately (never lose what the user typed).
   - Loops up to `MAX_MODEL_HOPS = 3`. Each hop reloads the transcript, works
     out which tools have already fired, and offers exactly one of:
     `mark_checkpoint` (until it fires) → `propose_task_breakdown` (after the
     checkpoint, until it fires) → no tools. This **tool swap is the
     mechanical guard** against a premature breakdown — the model cannot
     propose tasks before the project is defined, regardless of prompt
     discipline.
   - `toApiMessages` rebuilds the OpenRouter request from the normalized
     `messages` rows: a stored tool-call row becomes an assistant
     `tool_calls` message plus a synthetic `{ role: 'tool', content: 'ok' }`
     result. Tool *results* are never persisted — they carry no information.
   - On a tool call: validate the arguments, persist a `messages` row with
     `tool_name`/`tool_args` set, update the Session's cached
     `project_summary` / `project_title`, and (for the breakdown) insert the
     `tasks` rows. Then loop again.
   - On a text reply: persist it and return. Phase is **derived**, never
     stored (see below).
4. **`src/lib/server/openrouter.ts`** — `complete()` POSTs to OpenRouter,
   throws on a non-2xx with a truncated body, and returns `{ content,
   toolCalls }` from `choices[0].message`. No streaming.
5. **`src/lib/server/interview-prompt.ts`** — the single system prompt (one
   for the whole Interview) and the two tool schemas. Authored with the
   `writing-for-agents` method: positive phrasing, one sharp firing criterion
   per tool, no process jargon that could leak to the user.
6. Back in the route, `handleSubmit` appends the user + assistant messages to
   local state and, if the breakdown just fired, fetches the proposed rows
   (they need their server-assigned ids for per-row editing).

### Phase is derived, not stored

There is no status column. `src/lib/phase.ts` `derivePhase(transcript,
todoistProjectId)` reads: `todoist_project_id` set → `Completed`; else a
`propose_task_breakdown` row exists → `Proposed`; else a `mark_checkpoint`
row exists → `Drilling`; else `Defining`. The History view, the review-route
guard, and each turn result all derive it from the same two inputs. A
reviewer looking for where Phase is written will not find it — that is
intentional (`CONTEXT.md` "Phase", `docs/plan.md` §7).

## Walked path: confirming the breakdown

1. **`src/routes/interview.tsx` / `interview_.$sessionId.tsx`** —
   `handleConfirmTask` calls `confirmTaskBreakdown`. The review route
   (`interview_.$sessionId.tsx`) is a direct-link sibling reachable by
   Session id; its `loader` + `require-reviewable-breakdown.ts` guard redirect
   anything that is not a Proposed/Completed Session the user owns. (The
   trailing `_` in the filename is TanStack Router's "do not nest under the
   `interview` layout" escape.)
2. **`src/lib/server/todoist-creation-actions.ts`** — decrypts the user's
   Todoist token (`token-crypto.ts`, AES-256-GCM, ADR-0002), builds the real
   ports (`createTodoistClient` + Drizzle), calls the orchestrator.
3. **`src/lib/server/todoist-creation.ts`** — `createTodoistTasks`: create
   the dedicated project, then each task flat inside it, then persist the
   Completed signal (`todoist_project_id` + each `todoist_task_id`) **last**.
   Any failure deletes the project (best-effort rollback) and returns one
   clean retryable message — no partial project is ever left behind.
   Re-confirming a Session that already has a `todoist_project_id` is a
   no-op success (idempotent retry).
4. **`src/lib/server/todoist.ts`** — the friendly priority enum
   (`normal|medium|high|urgent`) is mapped to Todoist's **inverted** 1–4
   integer scale here, at the API boundary (`toTodoistPriority`): Todoist's
   API `4` is the UI's most-urgent P1. Task `title` → `content`; due dates go
   through `due_string` (natural language, Todoist-parsed) only.

## Authentication

Better Auth is mounted as a catch-all route at `src/routes/api/auth/$.ts`
(both GET and POST). `src/lib/auth.ts` configures it: email+password,
`tanstackStartCookies()` **last** in the plugin list (otherwise sign-in
cookies are silently dropped — `docs/research.md` §4.1), and one
`additionalField` `todoistToken` that is never settable via the API and
never returned to the client. Route guards call `getSession()` in
`beforeLoad` and hand the result to the pure `requireAuthSession` /
`requireReviewableBreakdown` functions.

## Deployment gotchas

- **Nitro Vercel preset is required and pinned.** TanStack Start no longer
  bundles a Vercel adapter. Without `nitro({ preset: 'vercel' })` the client
  build still succeeds but every route 404s on Vercel (`x-vercel-error:
  NOT_FOUND`). The preset is pinned rather than autodetected because
  autodetection keys off a gitignored local file and silently falls back on a
  clean checkout. CI guards against a regression. See `vite.config.ts`.
- **Two Supabase connection strings, not interchangeable.** The running app
  uses the transaction-mode pooler (`DATABASE_URL`, port 6543, `prepare:
  false`); migrations use the direct/session connection
  (`MIGRATION_DATABASE_URL`, port 5432). The direct host is IPv6-only —
  `docs/research.md` §4.3 covers the full trap, including a misleading
  Supabase dashboard banner.
- **`BETTER_AUTH_SECRET` must be set for every deployed environment**,
  Preview included — Vercel sets `NODE_ENV=production` there and Better Auth
  refuses to boot on its default secret (ADR-0004, `docs/research.md`).

## Where the design decisions are written

| Decision | Where |
|---|---|
| Domain vocabulary | `CONTEXT.md` |
| Interview state machine, 3-tool architecture, MVP scope | `docs/plan.md` §6–10 |
| Better Auth over Supabase Auth; one migration history | `docs/adr/0001` |
| Application-level token encryption (AES-256-GCM) | `docs/adr/0002` |
| One shared Supabase project across environments | `docs/adr/0003` |
| `BETTER_AUTH_URL` unset on Preview | `docs/adr/0004` |
| Integration gotchas learned during the build | `docs/research.md` §4 |
| Single-sitting Interviews (no resume) | `docs/plan.md` §13 |
