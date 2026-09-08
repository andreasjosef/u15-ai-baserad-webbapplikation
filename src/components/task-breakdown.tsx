// The Task Breakdown review UI as one self-contained, presentational
// component (issue #54): the Proposed-phase editable review table and
// the Completed wrapped-up confirmation state, extracted from the
// Interview conversation screen so another surface (the review route,
// issue #53) can render them directly against server-loaded data.
//
// Pure like the other form components: the phase arrives as a prop and
// persistence arrives as injected callbacks — the same shape the
// existing review table already uses — so the tests drive the whole
// flow without a router, db, or network. The fallback children render
// only when there is nothing to review and the Interview isn't wrapped
// up; the Interview screen passes its answer form here, so form
// suppression (Proposed or Completed) stays in exactly one place.
import type { ReactNode } from 'react'

import type { Phase } from '../lib/phase.ts'
import type { TaskEditInput } from '../lib/task-input.ts'
import { TaskReview, type TaskActionResult, type TaskRow } from './task-review.tsx'

export interface TaskBreakdownProps {
  phase: Phase
  projectTitle: string | null
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
    return (
      <p
        role="status"
        className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
      >
        Your tasks are in Todoist — this Interview is wrapped up.
      </p>
    )
  }

  return <>{children}</>
}
