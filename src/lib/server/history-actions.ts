// Server functions behind the History view (issue #27). Same shape as
// interview-actions.ts: the session comes from `auth.api` directly so
// cookies work inside server functions, raw errors never cross the wire,
// and every failure returns a retryable message the user actually sees
// (plan.md §10 — no silent failures).
//
// The list itself is read straight off `interview_sessions` (its cached
// summary/title columns exist exactly so this list never joins out to
// the transcript per row), with Phase derived through the shared
// buildHistoryRows rules (lib/history.ts → lib/phase.ts) and the task
// count from a grouped count against `tasks`. Detail loads the
// transcript and the task list read-only.
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { and, asc, count, eq, inArray, isNotNull } from 'drizzle-orm'

import type {
  HistoryDetail,
  HistoryDetailResult,
  HistorySessionRow,
} from '../../components/history-view.tsx'
import { buildHistoryRows, type RawSessionRow } from '../history.ts'
import { auth } from '../auth.ts'
import { db } from './db/client.ts'
import { interviewSessions, messages, tasks } from './db/schema/index.ts'

export type HistoryResult =
  | { ok: true; sessions: Array<HistorySessionRow> }
  | { ok: false; message: string }

export const HISTORY_FAILURE = 'Something went wrong loading your history. Try again.'

export const getHistory = createServerFn({ method: 'GET' }).handler(async (): Promise<HistoryResult> => {
  try {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) {
      return { ok: false, message: 'You need to log in to view your history.' }
    }
    const sessionRows = await db
      .select({
        id: interviewSessions.id,
        createdAt: interviewSessions.createdAt,
        projectSummary: interviewSessions.projectSummary,
        projectTitle: interviewSessions.projectTitle,
        todoistProjectId: interviewSessions.todoistProjectId,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, session.user.id))
    const sessionIds = sessionRows.map((row) => row.id)
    if (sessionIds.length === 0) {
      return { ok: true, sessions: [] }
    }
    const toolRows = await db
      .select({ sessionId: messages.sessionId, toolName: messages.toolName })
      .from(messages)
      .where(and(inArray(messages.sessionId, sessionIds), isNotNull(messages.toolName)))
    const countRows = await db
      .select({ sessionId: tasks.sessionId, taskCount: count() })
      .from(tasks)
      .where(inArray(tasks.sessionId, sessionIds))
      .groupBy(tasks.sessionId)
    const toolNamesBySession = new Map<string, Array<string>>(
      toolRows.map((toolRow) => [toolRow.sessionId, []]),
    )
    for (const toolRow of toolRows) {
      if (toolRow.toolName !== null) {
        toolNamesBySession.get(toolRow.sessionId)?.push(toolRow.toolName)
      }
    }
    const taskCountsBySession = new Map(
      countRows.map((countRow) => [countRow.sessionId, countRow.taskCount]),
    )
    const raw: Array<RawSessionRow> = sessionRows.map((row) => ({
      sessionId: row.id,
      createdAt: row.createdAt,
      projectSummary: row.projectSummary,
      projectTitle: row.projectTitle,
      todoistProjectId: row.todoistProjectId,
      toolNames: toolNamesBySession.get(row.id) ?? [],
      taskCount: taskCountsBySession.get(row.id) ?? 0,
    }))
    return { ok: true, sessions: buildHistoryRows(raw) }
  } catch {
    return { ok: false, message: HISTORY_FAILURE }
  }
})

// Loads one Session's stored detail read-only: the transcript (user and
// assistant rows only — tool-call rows are internal, Phase has already
// been derived from them) and the task list in proposed order. No
// editing surface anywhere in the response (plan.md §13).
export const getHistoryDetail = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null || typeof (input as { sessionId?: unknown }).sessionId !== 'string') {
      throw new Error('Missing Interview reference.')
    }
    return { sessionId: (input as { sessionId: string }).sessionId }
  })
  .handler(async ({ data }): Promise<HistoryDetailResult> => {
    try {
      const session = await auth.api.getSession({ headers: getRequestHeaders() })
      if (!session) {
        return { ok: false, message: 'You need to log in to view your history.' }
      }
      const [owned] = await db
        .select({
          id: interviewSessions.id,
          projectSummary: interviewSessions.projectSummary,
          projectTitle: interviewSessions.projectTitle,
        })
        .from(interviewSessions)
        .where(and(eq(interviewSessions.id, data.sessionId), eq(interviewSessions.userId, session.user.id)))
        .limit(1)
      if (!owned) {
        return { ok: false, message: 'That Interview could not be found.' }
      }
      const messageRows = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(and(eq(messages.sessionId, owned.id), inArray(messages.role, ['user', 'assistant'])))
        .orderBy(asc(messages.createdAt))
      const taskRows = await db
        .select({
          title: tasks.title,
          description: tasks.description,
          priority: tasks.priority,
          dueString: tasks.dueString,
        })
        .from(tasks)
        .where(eq(tasks.sessionId, owned.id))
        .orderBy(asc(tasks.position), asc(tasks.createdAt))
      const detail: HistoryDetail = {
        projectTitle: owned.projectTitle,
        projectSummary: owned.projectSummary,
        // The SQL filters to user/assistant rows already; the content
        // null coalesce only covers an unexpectedly empty row.
        transcript: messageRows.map((row) => ({
          role: row.role as 'user' | 'assistant',
          content: row.content ?? '',
        })),
        tasks: taskRows.map((row) => ({
          title: row.title,
          description: row.description,
          priority: row.priority,
          dueString: row.dueString,
        })),
      }
      return { ok: true, detail }
    } catch {
      return { ok: false, message: HISTORY_FAILURE }
    }
  })
