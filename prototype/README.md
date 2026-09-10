# Prototype: Task Breakdown proposal review + Completed confirmation

**Question** (issue #107): what should the Task Breakdown proposal review
(`src/components/task-review.tsx`) and the Completed confirmation
(`src/components/task-breakdown.tsx`'s `completed` branch) actually look
like — resolved together as one prototype so both read as a consistent
ending to the Interview flow? Today's card grid uses a one-off
full-width `bg-primary` header band and loses priority/order legibility
past a handful of tasks; the Completed state is a single boxed line with
no payoff and no link to the created Todoist project.

**How to view**: `npm run dev`, log in, open any Interview's review route
at `/interview/<sessionId>` with `?variant=` set to one of:

- `a-proposed` / `a-completed` — **A: Ordered list**
- `b-proposed` / `b-completed` — **B: Lightweight cards**
- `c-proposed` / `c-completed` — **C: Grouped by priority**
- no param, or `current` — today's shipped UI

A floating pill at the bottom of the screen — dev builds only — cycles
through all seven with the arrow buttons or `←`/`→`. Each of the three
directions previews **both** its proposal layout and its Completed
payoff regardless of that Interview's actual Phase (see "What's real vs.
stubbed" below), so a reviewer can judge the pair together without
needing two Interviews in two different phases. Two real Interviews to
try it against, if you don't have your own handy: a Proposed one with 20
tasks (`dc733aff-6425-4c1c-9e0f-e27c70a1ee7b`) and a Completed one
already linked to a Todoist project (`3fe89408-b913-4425-b0c0-7cedddb61198`).

## The three directions

- **A — Ordered list.** Drops the card grid entirely for a single-column
  list: a numbered badge and a priority-colored dot on every row make
  order and priority readable at a glance without needing to scan a
  grid. Completed: a minimal centered line — checkmark, task count, and
  a plain text link to the Todoist project. Bet: this is fundamentally a
  short edit form, not a gallery of objects — treat it like one.
- **B — Lightweight cards.** Keeps the grid format (closest to today)
  but drops the `bg-primary` header band — the one-off nothing else in
  the app uses — for a slim priority-colored top edge plus a small order
  badge per card. Completed: a bigger centered card with a filled
  checkmark badge, a real heading, and a primary "Open in Todoist"
  button. Bet: the grid itself was never the problem, the header band
  was — the payoff should feel like an equally deliberate destination.
- **C — Grouped by priority.** Restructures the list into sections —
  Urgent → High → Medium → Normal — so priority reads from grouping
  instead of a per-row label; a small `#n` chip keeps the original
  overall order traceable once tasks are split across sections.
  Completed: a "receipt" — a checkmark followed by a count-per-priority
  breakdown that mirrors the grouped structure, then the Todoist link.
  Bet: for a task list where priority is the thing that matters most,
  grouping communicates it more directly than a badge ever could.

Each variant is a self-contained component (`TaskEndingVariantA` / `B` /
`C` in `src/components/prototype-task-ending-variants.tsx`) — no shared
layout between them, per `prototype/UI.md`'s anti-pattern list. What they
do share is the edit/commit logic (`useTaskEndingEditing` in
`prototype-task-ending-logic.ts`, lifted unchanged from
`task-review.tsx`): blur-to-commit fields, commit-on-change priority, an
emptied title snapping back, and a `${taskId}:${field}`-keyed retryable
failure. Issue #107 is explicit that this is "a layout/density question,
not a functionality change," so forking that logic three times would
only risk the variants disagreeing about what a valid edit is — not a
question this prototype is asking. Priority's visual language (a dot +
color per level: gray/normal, purple/medium, amber/high, red/urgent) is
shared too, since it's a content decision common to all three, not a
layout one.

## What's real vs. stubbed

Real: the review route's actual loader data (project title, tasks in
their real order) and the actual `onUpdateTask` / `onAddTask` /
`onRemoveTask` / `onConfirmTask` server functions — editing or confirming
through any variant mutates the real Interview exactly like the shipped
UI does. `todoistProjectId` is real too: `getTaskBreakdown` already
queried it internally for Phase derivation, it just wasn't returned to
the caller — this prototype adds it to `TaskBreakdownResult` and threads
it through as a prop (the exact wiring issue #107 flagged as needed).
Confirming a Proposed Interview through any variant now re-fetches so the
freshly-written project id shows up immediately.

Stubbed: nothing needed stubbing for data. The one prototype-only
addition is `state: 'proposed' | 'completed'`, which lets a variant
render its Completed payoff independent of the Interview's actual
derived Phase — without it, judging "does the proposal review and the
Completed screen feel like one consistent ending" would require finding
or creating two Interviews in two different phases every time. This
means a Proposed Interview's `-completed` slides show a real link only
if that Interview happens to already have one (it won't, if it's still
Proposed) — the Todoist link renders its "not confirmed yet" fallback
copy in that case rather than a fake id.

## Open questions surfaced while building this

- **Priority color language** (gray/purple/amber/red) is new — nothing
  in the app assigned colors to priority before this. If a direction
  wins, that mapping needs an explicit call, not just inherited by
  default from whichever variant reads best.
- **Variant C's grouping** hides a task's neighbors-by-time if a Session
  never reorders within a priority level — worth confirming the mockup
  reviewer actually wants "priority" as the primary axis over "the order
  the model proposed them in," since A and B keep the flat order as
  primary and layer priority on top instead.
- **The `state` search-param override** is prototype-only scaffolding,
  not a real feature — nothing about previewing a Completed payoff on a
  still-Proposed Interview should survive into the real implementation.

## Capture

**Verdict**: not yet decided — this branch is the primary source for
that decision, not the decision itself. Whoever picks a direction (or a
mix, e.g. "A's list for the review with B's card payoff for Completed")
should record the verdict and the reasons here, then fold only the
winning JSX into `task-review.tsx` / `task-breakdown.tsx`, thread
`todoistProjectId` through for real if a direction wants the link, and
drop everything else — the other variants, the `?variant=` switcher, the
`state` override, and `prototype-task-ending-logic.ts` (or fold it back
into `task-review.tsx` if nothing else needs it) — from `dev` entirely.
This branch stays out of `dev`/`main` as the record of what was tried and
rejected.
