// The Task Breakdown review UI as one self-contained, presentational
// component (issues #54, #69): the Proposed-phase editable review cards
// and the Completed wrapped-up confirmation state, extracted from the
// Interview conversation screen so another surface (the review route,
// issue #53) can render them directly against server-loaded data.
//
// Pure like the other form components: the phase arrives as a prop and
// persistence arrives as injected callbacks — the same shape the review
// cards already use — so the tests drive the whole
// flow without a router, db, or network. The fallback children render
// only when there is nothing to review and the Interview isn't wrapped
// up; the Interview screen passes its answer form here, so form
// suppression (Proposed or Completed) stays in exactly one place.
import type { ReactNode } from 'react'

import { CheckIcon } from 'lucide-react'

import type { Phase } from '../lib/phase.ts'
import type { TaskEditInput } from '../lib/task-input.ts'
import { groupTasksByPriority, PRIORITY_META } from './task-priority-groups.ts'
import { TaskReview, type TaskActionResult, type TaskRow } from './task-review.tsx'

export interface TaskBreakdownProps {
  phase: Phase
  projectTitle: string | null
  // The Todoist project the Interview created on confirm (issue #110).
  // Non-null whenever the phase is Completed — derivePhase only reaches
  // 'Completed' once the project exists — so the receipt renders its
  // link unconditionally, with no "not yet linked" fallback state.
  todoistProjectId: string | null
  tasks?: ReadonlyArray<TaskRow>
  pending: boolean
  onUpdateTask?: (taskId: string, task: TaskEditInput) => Promise<TaskActionResult>
  onAddTask?: (task: TaskEditInput) => Promise<TaskActionResult>
  onRemoveTask?: (taskId: string) => Promise<TaskActionResult>
  onConfirmTask?: () => Promise<TaskActionResult>
  // Rendered only when no breakdown is being reviewed and the Interview
  // isn't wrapped up — the conversation's answer form, on the Interview
  // screen; nothing, on a surface that only hosts the review.
  children?: ReactNode
}

export function TaskBreakdown({
  phase,
  projectTitle,
  todoistProjectId,
  tasks,
  pending,
  onUpdateTask,
  onAddTask,
  onRemoveTask,
  onConfirmTask,
  children,
}: TaskBreakdownProps) {
  const completed = phase === 'Completed'
  const reviewing =
    phase === 'Proposed' &&
    projectTitle !== null &&
    tasks !== undefined &&
    onUpdateTask !== undefined &&
    onAddTask !== undefined &&
    onRemoveTask !== undefined

  if (reviewing) {
    return (
      <TaskReview
        projectTitle={projectTitle}
        tasks={tasks}
        pending={pending}
        onUpdateTask={onUpdateTask}
        onAddTask={onAddTask}
        onRemoveTask={onRemoveTask}
        onConfirmTask={onConfirmTask}
      />
    )
  }

  if (completed) {
    // The wrapped-up confirmation (issues #69, #110): a receipt in the
    // same card language as the review screen — a checkmark, a
    // count-per-priority breakdown mirroring the review sections (same
    // shared priority module, same Urgent→Normal order, same
    // singular/plural wording), and a link to the Todoist project the
    // Interview created. `derivePhase` only returns 'Completed' once
    // `todoistProjectId` is set, so the link renders unconditionally.
    const groups = groupTasksByPriority(tasks ?? [])
    return (
      <div
        role="status"
        className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 text-sm text-card-foreground"
      >
        <div className="flex items-center gap-2">
          <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <p>Your tasks are in Todoist — this Interview is wrapped up.</p>
        </div>
        <div className="flex flex-col gap-1">
          {groups.map(({ priority, tasks: rows }) => (
            <div key={priority} className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${PRIORITY_META[priority].dot}`} />
              <span className="font-medium">{PRIORITY_META[priority].label}</span>
              <span className="text-muted-foreground">
                {rows.length} task{rows.length === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
        <a
          href={`https://app.todoist.com/app/project/${todoistProjectId}`}
          target="_blank"
          rel="noreferrer"
          className="self-start font-medium text-primary underline-offset-4 hover:underline"
        >
          Open your project in Todoist
        </a>
      </div>
    )
  }

  return <>{children}</>
}
