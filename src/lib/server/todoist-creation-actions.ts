// Server function behind the review table's confirm button (issue #26).
// The model never sees `create_todoist_tasks` — this is a direct backend
// action, fired only by the user's confirm. Mirrors
// interview-actions.ts/todoist-settings-actions.ts: auth via `auth.api`
// directly so cookies work inside server functions, ownership checked
// against the Session row, raw errors never cross the wire, and every
// failure is one clean retryable message (plan.md §10).
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { and, asc, eq } from 'drizzle-orm'

import { toTaskPriority } from '../task-input.ts'
import { auth } from '../auth.ts'
import { db } from './db/client.ts'
import { interviewSessions, tasks, user } from './db/schema/index.ts'
import { decryptToken, loadTokenEncryptionKey } from './token-crypto.ts'
import { createTodoistClient } from './todoist.ts'
import { createTodoistTasks, TODOIST_CREATION_FAILURE, type TodoistCreationPorts } from './todoist-creation.ts'

export type ConfirmBreakdownResult = { ok: true } | { ok: false; message: string }

async function ownedSessionId(userId: string, sessionId: unknown): Promise<string | null> {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    return null
  }
  const [row] = await db
    .select({ id: interviewSessions.id })
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.userId, userId)))
    .limit(1)
  return row?.id ?? null
}

// The real ports: the Todoist REST client over the user's own decrypted
// token (ADR-0002 — decryption happens only here, at the point of
// calling the Todoist API), and one transaction persisting the Completed
// signal plus each task's Todoist id.
function realPorts(apiToken: string): TodoistCreationPorts {
  const client = createTodoistClient({ apiToken })
  return {
    createProject: (projectTitle) => client.createProject(projectTitle),
    createTask: (projectId, task) =>
      client.createTask(projectId, {
        content: task.content,
        description: task.description,
        priority: task.priority,
        dueString: task.dueString,
      }),
    deleteProject: (projectId) => client.deleteProject(projectId),
    markSessionCompleted: async (sessionId, todoistProjectId, createdTasks) => {
      await db.transaction(async (tx) => {
        await tx
          .update(interviewSessions)
          .set({ todoistProjectId })
          .where(eq(interviewSessions.id, sessionId))
        for (const task of createdTasks) {
          await tx
            .update(tasks)
            .set({ todoistTaskId: task.todoistTaskId })
            .where(eq(tasks.id, task.taskId))
        }
      })
    },
  }
}

export const confirmTaskBreakdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null || typeof (input as { sessionId?: unknown }).sessionId !== 'string') {
      throw new Error('Missing Interview reference.')
    }
    return { sessionId: (input as { sessionId: string }).sessionId }
  })
  .handler(async ({ data }): Promise<ConfirmBreakdownResult> => {
    try {
      const session = await auth.api.getSession({ headers: getRequestHeaders() })
      if (!session) {
        return { ok: false, message: 'You need to log in to confirm the task list.' }
      }
      const sessionId = await ownedSessionId(session.user.id, data.sessionId)
      if (!sessionId) {
        return { ok: false, message: 'That Interview could not be found.' }
      }
      const [sessionRow] = await db
        .select({
          projectTitle: interviewSessions.projectTitle,
          todoistProjectId: interviewSessions.todoistProjectId,
        })
        .from(interviewSessions)
        .where(eq(interviewSessions.id, sessionId))
        .limit(1)
      // Already confirmed — confirming again is a no-op success, so a
      // double-click or a retry after a slow response never duplicates
      // the project in Todoist.
      if (sessionRow?.todoistProjectId != null) {
        return { ok: true }
      }
      if (sessionRow?.projectTitle == null) {
        return { ok: false, message: 'That Interview has no task list to confirm yet.' }
      }
      const [userRow] = await db
        .select({ todoistToken: user.todoistToken })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1)
      if (!userRow?.todoistToken) {
        return { ok: false, message: 'Save your Todoist token in Settings first, then confirm again.' }
      }
      const apiToken = decryptToken(userRow.todoistToken, loadTokenEncryptionKey())

      const rows = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          priority: tasks.priority,
          dueString: tasks.dueString,
        })
        .from(tasks)
        .where(eq(tasks.sessionId, sessionId))
        .orderBy(asc(tasks.position), asc(tasks.createdAt))

      const result = await createTodoistTasks(
        realPorts(apiToken),
        sessionId,
        sessionRow.projectTitle,
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          // Defensive coercion, matching interview-actions.ts: a value
          // the app never wrote reads as "normal" rather than reaching
          // the Todoist mapping as a bogus enum.
          priority: toTaskPriority(row.priority),
          dueString: row.dueString,
        })),
      )
      if (!result.ok) {
        return result
      }
      return { ok: true }
    } catch {
      // A missing TOKEN_ENCRYPTION_KEY, a corrupted stored token, or any
      // wire/db failure all land here — the orchestrator's rollback has
      // already removed any partial project, so this is one clean,
      // retryable failure (plan.md §10).
      return { ok: false, message: TODOIST_CREATION_FAILURE }
    }
  })
