// The Interview route (issues #24 and #25). `beforeLoad` reuses the same
// guard as the home route; the conversation itself is single-sitting
// (plan.md §13) — the route always starts a fresh Session, and the
// transcript is kept in local state for the visit while the server
// persists every turn to `messages`.
//
// Once `propose_task_breakdown` fires (issue #25), the Proposed phase
// swaps the conversation for the editable review table. The proposed
// rows are loaded from the server (they need their row ids), and every
// edit is applied optimistically before its server call — a failure
// reverts the row and surfaces the retryable message.
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { InterviewView, type InterviewMessage, type InterviewSubmitResult } from '../components/interview-view.tsx'
import type { TaskActionResult, TaskRow } from '../components/task-review.tsx'
import type { Phase } from '../lib/phase.ts'
import { requireAuthSession } from '../lib/require-auth-session.ts'
import type { TaskEditInput } from '../lib/task-input.ts'
import {
  addTaskToBreakdown,
  getTaskBreakdown,
  INTERVIEW_FAILURE,
  removeTaskFromBreakdown,
  sendInterviewMessage,
  startInterview,
  updateTaskInBreakdown,
} from '../lib/server/interview-actions.ts'
import { getSession } from '../lib/server/session.ts'

export const Route = createFileRoute('/interview')({
  beforeLoad: async () => {
    requireAuthSession(await getSession())
  },
  component: InterviewRoute,
})

function InterviewRoute() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<InterviewMessage>>([])
  const [phase, setPhase] = useState<Phase>('Defining')
  const [projectSummary, setProjectSummary] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Array<TaskRow>>([])
  const [pending, setPending] = useState(false)

  // Returns the retryable failure message on error, null on success —
  // a failed load must never silently strand the user in the chat view
  // instead of the review table (plan.md §10).
  async function loadBreakdown(sessionId: string): Promise<string | null> {
    const breakdown = await getTaskBreakdown({ data: { sessionId } })
    if (breakdown.ok) {
      setProjectTitle(breakdown.projectTitle)
      setTasks(breakdown.tasks)
      return null
    }
    return breakdown.message
  }

  async function handleSubmit(message: string): Promise<InterviewSubmitResult> {
    setPending(true)
    try {
      const result = sessionId
        ? await sendInterviewMessage({ data: { sessionId, message } })
        : await startInterview({ data: { message } })
      if (!result.ok) {
        return result
      }
      setSessionId(result.sessionId)
      setPhase(result.phase)
      setProjectSummary(result.projectSummary)
      setProjectTitle(result.projectTitle)
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: message },
        { role: 'assistant', content: result.assistantReply },
      ])
      // The proposed rows need their server-assigned ids for the table's
      // per-row edits — fetch them as soon as the breakdown fires. The
      // turn itself succeeded (messages/phase already updated), so a
      // failed load surfaces as a retryable alert rather than silence.
      if (result.firedBreakdown) {
        const breakdownFailure = await loadBreakdown(result.sessionId)
        if (breakdownFailure !== null) {
          return { ok: false, message: breakdownFailure }
        }
      }
      return { ok: true }
    } catch {
      return { ok: false, message: INTERVIEW_FAILURE }
    } finally {
      setPending(false)
    }
  }

  async function handleUpdateTask(taskId: string, task: TaskEditInput): Promise<TaskActionResult> {
    if (!sessionId) {
      return { ok: false, message: INTERVIEW_FAILURE }
    }
    // Optimistic update; a failure re-syncs from the server rather than
    // reverting to a possibly-stale snapshot.
    setTasks((rows) =>
      rows.map((row) => (row.id === taskId ? { ...row, ...task } : row)),
    )
    try {
      const result = await updateTaskInBreakdown({ data: { sessionId, taskId, ...task } })
      if (!result.ok) {
        await loadBreakdown(sessionId)
      }
      return result
    } catch {
      await loadBreakdown(sessionId)
      return { ok: false, message: INTERVIEW_FAILURE }
    }
  }

  async function handleAddTask(task: TaskEditInput): Promise<TaskActionResult> {
    if (!sessionId) {
      return { ok: false, message: INTERVIEW_FAILURE }
    }
    try {
      const result = await addTaskToBreakdown({ data: { sessionId, ...task } })
      if (result.ok) {
        // Re-fetch so the new row carries its server-assigned id.
        await loadBreakdown(sessionId)
      }
      return result
    } catch {
      return { ok: false, message: INTERVIEW_FAILURE }
    }
  }

  async function handleRemoveTask(taskId: string): Promise<TaskActionResult> {
    if (!sessionId) {
      return { ok: false, message: INTERVIEW_FAILURE }
    }
    // Optimistic removal; a failure re-syncs from the server.
    setTasks((rows) => rows.filter((row) => row.id !== taskId))
    try {
      const result = await removeTaskFromBreakdown({ data: { sessionId, taskId } })
      if (!result.ok) {
        await loadBreakdown(sessionId)
      }
      return result
    } catch {
      await loadBreakdown(sessionId)
      return { ok: false, message: INTERVIEW_FAILURE }
    }
  }

  return (
    <InterviewView
      messages={messages}
      pending={pending}
      phase={phase}
      projectSummary={projectSummary}
      projectTitle={projectTitle}
      tasks={tasks}
      onUpdateTask={handleUpdateTask}
      onAddTask={handleAddTask}
      onRemoveTask={handleRemoveTask}
      onSubmit={handleSubmit}
    />
  )
}
