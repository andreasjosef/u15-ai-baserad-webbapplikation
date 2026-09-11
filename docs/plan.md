# Project plan

Working name: **Hone** (placeholder — search-replace if the team lands on something else).

Status: design agreed, no code written yet. This doc is the shared understanding reached during planning on 2026-08-30 — update it as decisions change rather than letting it drift out of sync with reality.

## 1. Vision

Generalize the discipline of the `/grilling` skill — relentless, branching interviews that turn a fuzzy idea into a concrete plan — from coding projects into daily life. A user brings a vague feeling ("I should sort out the garage," "I want to get healthier"); the app drills with them, first converging on what the project actually *is*, then keeps drilling until it has arrived at concrete units of work, which it pushes into Todoist as real tasks.

This framing directly answers the assignment's required reflection: a static todo app or form can't do the active, adaptive questioning that turns vague intent into a well-scoped project — that's the part that specifically needs an LLM, not a template or regex.

## 2. Assignment fit

See `docs/assignment.md` for the full brief. Grading strategy:

- **Godkänt bar**: met via the LLM interview + Todoist tool-calling, AI-assisted development throughout, and documented/commented code.
- **VG bar**: targeted via genuine tool-calling — the model itself calls `mark_checkpoint` and `propose_task_breakdown` as real, structured tool calls during the interview, backed by a real external side effect once the user confirms (`create_todoist_tasks`, see §7) — and deliberately-authored system prompts (see §6–7), rather than RAG (no retrieval corpus exists in this product shape, so it wasn't forced in). `docs/assignment.md`'s VG language doesn't require a specific count of model-initiated tool calls, just genuine/advanced use of the technique — confirmed during issue #5's grilling before relaxing this from an earlier draft that read as requiring exactly two.
- The three required reflection questions in the root `README.md` should be filled in once the app is actually built — draft answers are stubbed there now based on this plan, to be firmed up against what we actually shipped.

## 3. Team

Group of 5. No further workflow process defined here — this doc covers product/architecture decisions, not task assignment; see `docs/team-workflow.md`.

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend/full-stack framework | TanStack Start (RC), TypeScript | "Big language" per assignment tip; server functions keep the OpenRouter key off the client; see `docs/research.md` |
| Hosting | Vercel | Officially auto-detected for TanStack Start, lowest-friction path to a public demo URL |
| Database | Supabase (Postgres) | Backs accounts, Todoist tokens, and interview history |
| Auth | Better Auth, tables unified into the same Supabase Postgres schema as the app's own tables; email+password only for MVP | Real per-user accounts; ADR-0001 covers why Better Auth over Supabase Auth's RLS-based approach |
| UI / styling | Tailwind CSS + shadcn/ui | Fastest path to a consistent look with 5 people touching UI code independently |
| LLM gateway | OpenRouter | One integration surface, model-swappable via env var |
| Primary model | `anthropic/claude-sonnet-4.6` | Interview quality is an explicit priority; cost is trivial at our volume (see `docs/research.md`) |
| Dev/cheap model | `google/gemini-2.5-flash` | Swap in via env var for cheap iteration during development |
| Task destination | Todoist REST API v1, personal API token per user | No OAuth review overhead; tokens stored per-account |

## 5. Todoist integration

- Each user pastes their own Todoist personal API token into their account settings (stored server-side, associated with their user row — not client-visible after entry).
- A breakdown maps to **a dedicated Todoist project per Interview** — not the user's Inbox, not an existing project. The project's name comes from the model's own `project_title`. Tasks are **flat** inside that project: no top-level "project task," no `parent_id`, no nesting (revises the earlier one-level-hierarchy design — see issue #5's resolution).
- Priority and due dates are available fields on the tool schema (see §7) but not mandatory — the model decides what's relevant per breakdown. Labels were considered and dropped for MVP: their value is mostly cross-project consistency, which doesn't hold once the app doesn't fetch the user's existing label set and every Interview gets its own fresh project anyway.
- Todoist's `priority` field is inverted from its own UI: API `4` = the UI's most-urgent P1, API `1` = the UI's default P4. The tool schema exposes a friendly `"normal" | "medium" | "high" | "urgent"` enum instead, mapped to Todoist's integers at the API boundary.

## 6. Interview design

- **Multi-turn, one question at a time** — a real conversation, not a form.
- **Spirit of grilling, not its literal mechanics**: the system prompt enforces the *discipline* (never settle for a vague answer, keep drilling until a thread is actually resolved, converge explicitly before moving on) without exposing meta-concepts like "frontier" or numbered rounds to the end user.
- **Starts from a vague idea, not a pre-defined project**: the first phase of the conversation is about figuring out what the project actually is. Only once that's reasonably well-defined does the interview shift into decomposing it into tasks.
- **Light checkpoint between phases**: a natural conversational transition ("Sounds like the project is: X — let's break that into steps") marks the shift from "defining the project" to "drilling into tasks." This is not a separate tool call or UI screen — just a deliberate moment in the conversation where the user can correct a misread goal before turns get sunk into the wrong specifics.
- System prompt(s) for the interviewer are to be drafted using the `writing-for-agents` skill.

## 7. Tool-calling architecture

Three tool/function definitions, settled during issue #5's grilling (see that issue's resolution comment for the full state-machine writeup). No Phase is ever persisted as its own field — it's always derived from which of these have appeared so far in the Session's transcript (see CONTEXT.md's Phase entry).

1. **`mark_checkpoint`** — a model-initiated tool call with no Todoist side effect and no dedicated UI screen, invisible to the user as a distinct step. Available to the model from the first turn; fired once it judges the project well-defined, carrying a `project_summary` string. Marks the Checkpoint (Defining → Drilling) and drives a small persistent hint in the UI.
2. **`propose_task_breakdown`** — only added to the model's available tools *after* `mark_checkpoint` has fired. That's the mechanical guard against the model proposing a breakdown before the project is actually well-defined, rather than relying on prompt discipline alone. Structured args: a `project_title` plus a flat list of tasks (title, optional description/priority/due date — see §5). Result is rendered to the user as an editable review UI, *not* sent to Todoist yet.
3. **`create_todoist_tasks`** — **not** exposed to the model at all. Fired directly by the backend once the user confirms (and possibly edits) the proposal in the review UI. Creates the Todoist project first, then each task inside it; if any task creation fails partway, rolls back by deleting the project and reports one clean failure rather than a partial result.

`mark_checkpoint` and `propose_task_breakdown` are the two genuine model-initiated tool calls. `create_todoist_tasks` is the real external side effect, deliberately kept out of the model's hands: by the time it fires, the user has already fully specified its input in the review UI, so routing it through another model call would add no decision content — see §2's VG framing, revised alongside this.

## 8. Review & edit UX

Between the two tool calls, the user sees a **fully editable** table of the proposed breakdown: rename tasks, change due date/priority, add or remove tasks, before clicking confirm. This is the actual trust/verification mechanism for the whole product — a review step that could only accept-or-reject wholesale wouldn't meaningfully catch AI mistakes.

## 9. Data model / persistence

Supabase stores:
- User accounts (via Better Auth or equivalent).
- Each user's Todoist personal API token, encrypted at rest (application-level AES-256-GCM, not a DB-native extension — see `docs/adr/0002-application-level-token-encryption.md`).
- **Full interview transcripts** (every Q&A turn, not just the final result) plus the resulting task breakdown, per session — surfaced as a history/dashboard.

Storing full transcripts (not just final breakdowns) is a deliberate choice made now, even though the features it enables are stretch/backlog — retrofitting capture later would mean losing all data from before the retrofit.

Concrete table layout (`interview_sessions`, `messages`, `tasks`, Better Auth's own tables plus `user.todoistToken`) settled during issue #6's grilling — see that issue's resolution comment and `CONTEXT.md`'s Session entry.

## 10. MVP scope (target: presentable by Sep 11)

- Accounts (sign up / log in).
- Connect a Todoist personal API token.
- Interview: vague idea → checkpoint → task drilling → `propose_task_breakdown`.
- Review/edit UI for the proposed breakdown.
- Confirm → `create_todoist_tasks` → real tasks appear in the user's Todoist.
- History view: a flat, chronological list of past Sessions (most recent first), each row showing its Phase badge, creation date, and task count; clicking a row expands it in place with a Transcript/Task Breakdown tab switch — no separate detail page or modal. Settled during issue #7's prototype (three variants tried: accordion list, master-detail split, kanban-by-phase); full variant set kept as a primary source on the unmerged `prototype/history-view` branch, not in this repo's mainline. Read-only for every Phase, including Defining/Drilling/Proposed — see §13 for the single-sitting decision this prototype surfaced.
- A deliberately well-crafted system prompt, not a generic chatbot wrapper.
- **Error-handling bar**: no silent failures — the user always sees that something went wrong and can retry — but no retry/backoff logic, offline handling, or polished empty/error-state design. Keeps every ticket's effort consistent given the 8-day runway.

## 11. Stretch backlog (only if time remains after MVP)

- **Memory / retro / follow-up system**: use stored transcripts to check in later ("how did the garage project go?") or inform future interviews with context from past ones.
- **Semantic search over past interviews**: embeddings-based search/pattern-finding across a user's history of projects — notably, this would also let the write-up speak to the "embeddings" track the assignment brief itself suggests, on top of the tool-calling/system-prompt story already covered by the MVP.
- Editing polish, richer Todoist fields (labels/priority defaults), multi-level task nesting if Todoist's model is revisited.

## 12. Timeline

- **Today**: 2026-08-30. Plan agreed, no code yet.
- **2026-09-11**: oral presentation — app must be in presentable (MVP) shape.
- **2026-09-14, 23:59**: final submission deadline (GitHub repo + README with reflection, submitted via Canvas).

## 13. Open items / risks

- TanStack Start is RC, not 1.0 — expect possible minor API churn; pin versions and re-check docs against `tanstack.com/start/latest` if something behaves unexpectedly (see `docs/research.md`).
- The README reflection answers are currently drafts based on this plan (see root `README.md`) — revisit them once the app is actually built, especially "why AI was needed" and "what would we have done differently," which should reflect real experience, not just the plan.
- No app name has been chosen yet.
- **Resumability of incomplete Interviews, settled: single-sitting.** Surfaced while prototyping the history view (issue #7); an initial "resumable" design was drafted and graduated into its own spec, then rolled back before implementation. An Interview only ever happens in one sitting — Sessions in the Defining/Drilling/Proposed Phases appear in history same as Completed ones, but read-only, with no entry point back into `/interview`. An abandoned Interview is simply restarted as a brand-new Session; nothing beyond what issues #5-#7 already built is needed to support this.
