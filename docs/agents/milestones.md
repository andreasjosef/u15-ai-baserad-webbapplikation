# Milestones: the root of the spec fractal

A milestone isn't a separate tracked object — it's a **position** in the
same spec fractal every other decision runs through: the top-most spec
(Problem / Solution / User Stories, produced by `/to-spec`) with no spec
above it, an outward-facing description of a state of the software as a
whole. See the `tools` repo's `agentic-dev/adr/0009-spec-scope-is-a-
fractal-milestone-is-the-root.md` for the model this inherits.

## Conventions

- **Rationale**: the root spec's own Problem Statement — same shape as
  any other spec, not a separate description field on a Milestone object.
- **Tracking**: the root spec issue's own **sub-issue tree**. Every
  ticket and child spec nested under it, at whatever depth, rolls up to
  it automatically through native sub-issue linking (see
  `issue-tracker.md`'s "Link as a sub-issue").
- **Progress / roll-up**: `gh issue view <root-spec-n> --json
  subIssuesSummary` reads how many of the root spec's nested issues are
  open vs. closed. There is no `gh api ... milestones` step — that
  endpoint tracks a different, unrelated GitHub object and isn't used
  here.
- **Completion**: structural, not date-driven — a milestone is done when
  every spec nested directly inside it is done (the same recursive rule
  that applies at any depth of the spec fractal, not a milestone-specific
  one).

## When a skill or doc says "file it as a milestone"

Nothing extra to file. The map → `/to-spec` output that has no spec
above it *is* the milestone — the normal `grilling`/`wayfinder` →
`to-spec` → `to-tickets` flow already produces it as a side effect of
resolving the first root-level map.

## Define one at a time

Per `docs/team-workflow.md` §9, don't chart the whole milestone sequence
up front. Define the next one — i.e. start the next root-level
map/spec — once the current one is reached, or clearly in sight.

## Legacy: the "Submission" GitHub Milestone

`Submission` (GitHub Milestone #1) was filed on 2026-09-01 under the
older, since-reconciled convention (`adr/0007`'s tracking mechanism, now
superseded by `adr/0009`). Its description is already Problem-Statement-
shaped (why this milestone + done-criteria drawn from `docs/plan.md` §10
and `docs/assignment.md`) — that content is what should become the MVP
root spec's own Problem Statement once `/to-spec` runs on the MVP
wayfinder map, rather than being re-derived from scratch. Once that root
spec exists, milestone #1 the GitHub object is redundant and can be
closed; it isn't deleted or backdated, just superseded by the sub-issue
tree doing the same job going forward.
