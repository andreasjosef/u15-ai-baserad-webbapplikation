# Team workflow

Status: drafted via a `/grilling` session on 2026-08-30 — not yet agreed by the team. Getting the team to actually agree on this doc (amend it, argue with it, ratify it) is a good candidate for one of the first practice issues, exercising the grilling → to-spec → to-tickets loop on the process itself before using it on the product. Update it as the process changes rather than letting it drift out of sync with how we actually work.

This covers **how the five of us work together** day to day: who's in the room for which decisions, how work moves from a vague idea to merged code, and how bugs get handled. It complements `docs/plan.md` (product/architecture decisions, already settled) and the tracker docs in `docs/agents/` (mechanics an agent needs — issue tracker conventions, triage labels, domain doc layout). This doc is written for this project specifically, not as a generic template — lift from it later if it proves out.

## 1. The loop

The skill chain stays the same one used solo: `grilling` → `to-spec` → `to-tickets` → `implement` (which runs `/code-review` and TDD internally) → merge. `diagnosing-bugs` and `triage` sit alongside it for anything that isn't new work. What changes for a team of five is **who's present for which step**, not the steps themselves — implementation is agent-driven and fast enough that splitting it across people doesn't buy us anything; the actual coordination problem is upstream, in the decisions.

## 2. Decision-making: who has to be in the room

- **Architecture-level / high-stakes decisions** (the kind already captured in `docs/plan.md`): a live mob session, whole team or as close to it as we can get. One person drives the CLI, everyone weighs in.
- **Feature-level specs** (the normal case as the project progresses): **paired grilling** — at least two teammates live, any two, it doesn't need to be a specific role. The pair runs `grilling` together straight into `to-spec` and `to-tickets`. The pairing *is* the sign-off — having a second live voice pushing back is what a solo session can't get from itself, so don't bolt an async approval on top of it; that just re-adds the latency pairing was meant to avoid.
- **Solo fallback**: if genuinely nobody else is free, grilling alone is allowed, but the resulting spec then needs an explicit async approval — a comment or reaction from another teammate — before `to-tickets` runs. This is the exception path, not the default; use it when it's true, not as a shortcut around finding a second person.
- **Trivial work** (a bug, a small well-understood change) skips grilling and `to-spec` entirely and goes straight to a ticket — see §6 for bugs, and use the same judgment for tiny enhancements: if there's nothing to actually decide, don't manufacture a grilling session for it.

## 3. Ticket splitting & the shared queue

- When running `to-tickets`, treat the blocking edges as a lever for **parallelism**, not just correctness. Aim for a frontier of roughly **2–3 simultaneously startable tickets** at a time, matching how many of us are likely to be driving agents at once — don't just take whatever vertical-slice decomposition falls out by default if a wider cut is available without sacrificing the tracer-bullet rules.
- Tickets are **claimed, not owned**: `ready-for-agent` issues sit in one shared queue on the tracker. Whoever's next available claims one — `gh issue edit <n> --add-assignee @me`, before starting anything, same convention `/wayfinder` uses — purely to stop two people's agents grabbing the same ticket. It is not a sprint assignment; nobody "owns" an area of the ticket queue.
- **Usage budget**: no tracking spreadsheet. Before claiming, do a quick gut-check on remaining agent usage for the session, and bias toward a smaller ticket when running low. Whoever has headroom takes more or bigger tickets. This is a norm, not infrastructure.
- **Rotation**: nobody should reach the Sep 11 oral defense never having driven a ticket outside one area of the stack (auth, the LLM interview, Todoist integration, UI). Not mechanically enforced — raise it at the standing sync (§4) if the queue looks like it's skewing into silos.

## 4. Cadence

- **Fixed floor**: a short sync every 2–3 days, to catch drift and keep everyone oriented, since not everyone will be online every day. This is not a status-update standup — the bottleneck on a 2-week project is decision moments, not who-did-what.
- **Everything else is event-triggered**: grill together when a spec-sized decision is ready, review together when a PR is up, pull in whoever's needed the moment something's blocked. Don't force a daily ritual onto a project this short.

## 5. From ticket to merged code

- **`main` is always deployable.** Vercel deploys production from it, so nothing lands on `main` that hasn't already been integrated and working on `dev`. `dev` is the shared integration branch tickets land on day to day, and it's the repo's **default branch** — new clones and PRs point there, not `main`.
- One branch per ticket, off `dev`.
- Run `/implement` on the claimed ticket. TDD at pre-agreed seams and the `/code-review` pass both happen automatically as part of that skill — don't add a separate manual pre-review layer on top, that's already the skill's own final step.
- Open a PR **into `dev`**. **At least one teammate other than the driver reviews and approves** before merge — this is also where the rotation/exposure from §3 happens for free, since reviewing a PR is the cheapest way to see code someone else wrote.
- **PR opened/closed notifications**: `.github/workflows/discord-pr-notifications.yml` posts every non-draft, non-bot PR `opened`/`closed` event to the team's Discord channel, silently (no `@role` mention). It builds the Discord message itself (`.github/scripts/discord-pr-notification.ts`, unit-tested via `vitest`) and posts directly to Discord's raw webhook API — not Discord's `/github`-formatted compatibility endpoint, which turned out to be known-flaky (valid GitHub payload in, empty Discord message out) and was replaced outright for that reason. Draft PRs and bot-authored PRs (e.g. a future Dependabot PR) are filtered via the workflow's own `if:` condition before either the message-building script or the Discord POST ever run — no longer an accepted gap. The webhook URL lives as the `DISCORD_WEBHOOK_URL` repo secret.
- **CI must be green before merge** (`.github/workflows/ci.yml`: typecheck + test). It has nothing to run against yet — the first scaffolding ticket needs to add `typecheck` and `test` npm scripts. Until then, CI failing is expected and correct; don't merge around it, add the scripts.
- Merge into `dev` once approved and green.
- **These two gates are GitHub-enforced, not just a norm.** The repo is public, and `dev` has branch protection: the `check` CI job must pass against an up-to-date branch, and at least 1 approving review is required, before GitHub will allow the merge button to be pressed at all.
- **Promoting `dev` to `main`**: whenever `dev` is in a good, demoable state — a natural checkpoint, not after every single ticket — open a `dev` → `main` PR to promote it, which is what actually goes live. Anyone can propose the promotion; it doesn't need an owner. Before the Sep 11 oral defense, `main` must be promoted and verified working, not just `dev`.
  - **Merge via a merge commit** — not squash, not rebase. The commits landing on `main` already went through `dev`'s own review gate above; a merge commit records the promotion point honestly, as a single new commit on `main` that keeps `dev`'s history intact, instead of rewriting or flattening it the way squash/rebase would.
  - **Tag and release**: tag the resulting `main` commit `v1.0.0` and cut a GitHub Release from that tag using auto-generated release notes (GitHub's "Generate release notes" button, sourced from the PRs merged into `dev` since the last tag) — no hand-written changelog.
  - **The gate is a hand-run production verification checklist, not a second code review.** The code already went through review on its way into `dev` (§5 above); bolting an approval on top of the promotion PR itself would just re-review the same diff a second time. Instead, whoever proposes the promotion runs this checklist by hand against the deployed production URL before merging:
    1. Sign up for a new account.
    2. Log in.
    3. Connect a Todoist personal API token.
    4. Run an Interview end-to-end through the proposed breakdown.
    5. Review/edit that breakdown.
    6. Confirm it and see the real tasks land in Todoist.
    7. Log out.
  - Only merge the promotion PR once every step above passes against production.

## 6. Bugs

- Anyone who finds a bug files it as a GitHub issue with the `bug` label first, for traceability — even if they're about to fix it themselves in the next five minutes.
- If they're fixing it immediately: self-assign, apply `ready-for-agent` directly, skip `needs-triage`, and run `/diagnosing-bugs`. There's no dedicated triage role on a team this size — the discoverer is the fixer by default.
- Only route it through the full `/triage` state machine (`needs-triage` → …) if it genuinely can't be resolved on the spot: it needs someone else's input, or it's a real "is this in scope" judgment call.

## 7. Handoff

Since not everyone will always be available, someone will inevitably start a ticket and need to step away before it's done. Before signing off mid-ticket, leave a one-paragraph comment on the issue describing state and next step. For anything meatier, run `/handoff` and link the resulting doc from that comment instead of retyping it. Most of the time there's nothing to hand off, since tickets are sized to one context window — but that's a judgment made on the way out, not an assumption.

## 8. Explicitly out of scope

The "agent ledger" idea sketched in `ideas.md` (a shared lock/mutex layer so concurrent agents can't collide on the same files) is **not** part of this project's workflow. Tracer-bullet ticket slicing already minimizes file overlap by design, at most 3 people run agents concurrently, and building a coordination ledger is itself a project — don't spend the two weeks we have solving that instead of the assignment. Worth revisiting for a bigger, longer-running effort later.

## 9. Milestones

- A milestone marks a **chapter closing** — a mid-flight "arrived somewhere" moment, and/or a native tracker record of an externally-imposed deadline — not the end of the project, and not in tension with the ongoing grilling → to-spec → to-tickets → implement loop.
- **A milestone is the root of the spec fractal, not a separate object.** It's the top-most spec (Problem/Solution/User Stories) produced by `/to-spec`, with no spec above it — the same artifact as any other spec, just sitting at the root position. There's no dedicated GitHub Milestone to create alongside it. Mechanics: `docs/agents/milestones.md`.
- **Define one milestone at a time.** Don't chart the whole sequence (the one after this one, and the one after that) up front — that's guessing at problems the project hasn't hit yet. Define the next one once the current one is reached or clearly in sight.
- **Completion is structural**: a milestone is done when every spec nested directly inside it is done — the same recursive rule that applies at any depth of the loop, not a milestone-specific one. The real judgment that remains is scope creep: does newly-discovered work belong to this milestone or the next, settled by whether it serves the root spec's own Problem Statement. Where a date is externally fixed (as with this project's own deadline), record it in that Problem Statement too, but it doesn't replace the criteria.
- **Tracked as the root spec's own sub-issue tree** — every ticket and child spec nested under it, at whatever depth, rolls up to it through native sub-issue linking. Not a separate planning doc, and not a separate Milestone object either; both can drift out of sync with the tracker in ways the sub-issue tree can't.
- **Rationale lives in the root spec's own Problem Statement**, same as any other spec — not a separate description field, and not an ADR either: ADRs are reserved for decisions about how the product itself is built, not roadmap/process decisions about it.
- **Decoupled from promoting `dev` → `main`** (§5): a milestone (the root spec and its sub-issue tree) and a promotion (a deploy action) are different kinds of events that may or may not coincide. Don't make one wait on the other.
- **Who decides**: defining or closing a milestone is an architecture-level decision (§2) — a whole-team mob call, since it re-points everyone's priority for a while, not a single feature spec one pair can settle alone.

First milestone: the MVP described in `docs/plan.md` §10, once a wayfinder map charts what's still open in it and `/to-spec` collapses that into the root spec. A **"Submission" GitHub Milestone** (#1) was filed solo on 2026-09-01 under the older, now-reconciled convention above — its description already carries the right rationale and done-criteria, and becomes that root spec's Problem Statement rather than being redone from scratch; see `docs/agents/milestones.md`'s Legacy note for how the two connect.

## 10. Where things live

- Tracker mechanics (creating/reading/labelling issues): `docs/agents/issue-tracker.md`.
- Triage label vocabulary: `docs/agents/triage-labels.md`.
- Domain docs (`CONTEXT.md`, ADRs — created lazily as terms/decisions land): `docs/agents/domain.md`.
- Milestone mechanics: `docs/agents/milestones.md`.
- Product/architecture decisions: `docs/plan.md`.
- This doc: the team-facing process that ties those together. Read it alongside `docs/plan.md`, not instead of it.
