// The Task Breakdown review route (issue #55), addressed by the
// Interview Session's id and sibling to the conversation route —
// reachable by direct link only (the conversation screen does not link
// here yet). Fresh navigation, a refresh, or reopening the tab later
// loads the proposed project title, tasks, and Phase straight from the
// server through the same task-breakdown fetch the conversation screen
// uses — nothing is carried over from the conversation.
//
// The access guard (lib/require-reviewable-breakdown.ts) redirects to
// the conversation route when the Session isn't the signed-in user's,
// doesn't exist, or hasn't reached the Proposed phase; a Proposed
// Session renders the fully editable review table and a Completed one
// the wrapped-up state, both via the component extracted in issue #54.
// Confirming successfully keeps the user right here, now Completed; a
// failed confirm leaves the table untouched with the retryable error.
// There is no way back to the conversation from this route.
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { TaskBreakdown } from '../components/task-breakdown.tsx'
import type { TaskActionResult, TaskRow } from '../components/task-review.tsx'
import type { Phase } from '../lib/phase.ts'
import { requireAuthSession } from '../lib/require-auth-session.ts'
import { requireReviewableBreakdown } from '../lib/require-reviewable-breakdown.ts'
import type { TaskEditInput } from '../lib/task-input.ts'
import {
  addTaskToBreakdown,
  getTaskBreakdown,
  INTERVIEW_FAILURE,
  removeTaskFromBreakdown,
  updateTaskInBreakdown,
} from '../lib/server/interview-actions.ts'
import { confirmTaskBreakdown } from '../lib/server/todoist-creation-actions.ts'
import { getSession } from '../lib/server/session.ts'

export const Route = createFileRoute('/interview_/$sessionId')({
  beforeLoad: async () => {
    requireAuthSession(await getSession())
  },
  loader: async ({ params }) => {
    const breakdown = await getTaskBreakdown({ data: { sessionId: params.sessionId } })
    return requireReviewableBreakdown(breakdown)
  },
  component: TaskBreakdownReviewRoute,
})

function TaskBreakdownReviewRoute() {
  const { sessionId } = Route.useParams()
  const initial = Route.useLoaderData()
  const [phase, setPhase] = useState<Phase>(initial.phase)
  const [projectTitle, setProjectTitle] = useState<string | null>(initial.projectTitle)
  const [tasks, setTasks] = useState<Array<TaskRow>>(initial.tasks)
  const [pending, setPending] = useState(false)

  // Returns the retryable failure message on error, null on success —
  // a failed re-sync must never leave the table silently stale.
  async function loadBreakdown(): Promise<string | null> {
    const breakdown = await getTaskBreakdown({ data: { sessionId } })
    if (breakdown.ok) {
      setPhase(breakdown.phase)
      setProjectTitle(breakdown.projectTitle)
      setTasks(breakdown.tasks)
      return null
    }
    return breakdown.message
  }

  async function handleUpdateTask(taskId: string, task: TaskEditInput): Promise<TaskActionResult> {
    // Optimistic update; a failure re-syncs from the server rather than
    // reverting to a possibly-stale snapshot.
    setTasks((rows) =>
      rows.map((row) => (row.id === taskId ? { ...row, ...task } : row)),
    )
    try {
      const result = await updateTaskInBreakdown({ data: { sessionId, taskId, ...task } })
      if (!result.ok) {
        await loadBreakdown()
      }
      return result
    } catch {
      await loadBreakdown()
      return { ok: false, message: INTERVIEW_FAILURE }
    }
  }

  async function handleAddTask(task: TaskEditInput): Promise<TaskActionResult> {
    try {
      const result = await addTaskToBreakdown({ data: { sessionId, ...task } })
      if (result.ok) {
        // Re-fetch so the new row carries its server-assigned id.
        await loadBreakdown()
      }
      return result
    } catch {
      return { ok: false, message: INTERVIEW_FAILURE }
    }
  }

  async function handleRemoveTask(taskId: string): Promise<TaskActionResult> {
    // Optimistic removal; a failure re-syncs from the server.
    setTasks((rows) => rows.filter((row) => row.id !== taskId))
    try {
      const result = await removeTaskFromBreakdown({ data: { sessionId, taskId } })
      if (!result.ok) {
        await loadBreakdown()
      }
      return result
    } catch {
      await loadBreakdown()
      return { ok: false, message: INTERVIEW_FAILURE }
    }
  }

  // Confirming the reviewed breakdown: on success the Phase moves to
  // Completed locally — the server's `todoist_project_id` write is the
  // durable source of that read, and the route re-reads it on every
  // load. A failure returns the message; the table is untouched, so
  // confirming again is the retry.
  async function handleConfirmTask(): Promise<TaskActionResult> {
    setPending(true)
    try {
      const result = await confirmTaskBreakdown({ data: { sessionId } })
      if (result.ok) {
        setPhase('Completed')
      }
      return result
    } catch {
      return { ok: false, message: INTERVIEW_FAILURE }
    } finally {
      setPending(false)
    }
  }

  return (
    <TaskBreakdown
      phase={phase}
      projectTitle={projectTitle}
      tasks={tasks}
      pending={pending}
      onUpdateTask={handleUpdateTask}
      onAddTask={handleAddTask}
      onRemoveTask={handleRemoveTask}
      onConfirmTask={handleConfirmTask}
    />
  )
}
