# Hone

An app that turns a vague idea ("I should sort out the garage") into concrete Todoist tasks, by relentlessly interviewing the user about it — the discipline of the `/grilling` skill, generalized from coding projects to daily life.

## Language

**Interview**:
The multi-turn, one-question-at-a-time conversation between the user and the app that turns a vague idea into a Task Breakdown. Spans the Defining and Drilling Phases (see Phase), separated by a Checkpoint, and ends once `propose_task_breakdown` fires and the Session moves into the Proposed Phase.
_Avoid_: chat, session (see Session below — an Interview is what happens *within* one, not the persisted row itself)

**Session**:
The persisted row an Interview happens within: one `interview_sessions` table row per Interview, holding the cached `project_summary`/`project_title` set at Checkpoint/proposal time and the resulting `todoist_project_id` once Completed, plus (via a separate `messages` table) the full transcript that Phase is derived from. Interview names the conversation; Session names its row in the database.
_Avoid_: interview session (redundant — "Session" already implies "of an Interview"), chat session

**Checkpoint**:
The conversational transition point inside an Interview where the app confirms its read of the project ("Sounds like the project is: X — let's break that into steps") before shifting from the Defining Phase to the Drilling Phase. Implemented as `mark_checkpoint`, a model-initiated tool call with no Todoist side effect and no dedicated UI screen — invisible to the user as a distinct step, even though it is a real tool call under the hood. Its `project_summary` argument also drives a small persistent hint shown in the UI once it fires.
_Avoid_: phase change, mode switch — Checkpoint names the moment, not the transition mechanism; the states themselves are Phase (see below)

**Phase**:
One of four states a Session moves through: Defining, Drilling, Proposed, or Completed. Defining until `mark_checkpoint` fires, Drilling until `propose_task_breakdown` fires, Proposed until `create_todoist_tasks` succeeds, then Completed. Never persisted as its own field — always derived from which tool calls have appeared so far in the Session's transcript.
_Avoid_: state, step, mode (Phase is specifically the derived read of interview/session progress, not a stored value)

**Task Breakdown**:
The structured output of a converged Interview: a `project_title` (used to create a dedicated Todoist project — never the user's Inbox or an existing project) plus a flat list of tasks under it (title, optional description/priority/due date; no nesting, no labels for MVP). Proposed via `propose_task_breakdown` for the user to review and edit, then, once confirmed, created in Todoist via `create_todoist_tasks` — a direct backend action, not a further model tool call — which creates the project first, then each task, rolling back the project if any task creation fails.
_Avoid_: plan, proposal (ambiguous with the product/pitch sense already used elsewhere in this repo's docs)
