// Server functions behind the Interview (issue #24). Mirrors
// todoist-settings-actions.ts: the session comes from `auth.api`
// directly so cookies work inside server functions, raw errors never
// cross the wire, and every failure returns a retryable message the
// user actually sees (plan.md §10 — no silent failures).
//
// The Interview logic itself lives in interview-turn.ts behind injected
// ports; this module is only the real wiring — Drizzle for persistence,
// OpenRouter for the model — so it stays thin enough to skip its own
// unit tests (the orchestrator, schema, and UI each carry them).
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { and, asc, desc, eq, isNotNull, max } from 'drizzle-orm'

import { parseInterviewMessage } from '../interview-input.ts'
import { derivePhase, type Phase } from '../phase.ts'
import type { TaskEditInput, TaskPriority } from '../task-input.ts'
import { parseTaskEdit, toTaskPriority } from '../task-input.ts'
import { auth } from '../auth.ts'
import { db } from './db/client.ts'
import { interviewSessions, messages, tasks, user } from './db/schema/index.ts'
import { runInterviewTurn } from './interview-turn.ts'
import {
  createOpenRouterClient,
  resolveInterviewApiKey,
  resolveInterviewModel,
} from './openrouter.ts'
import { decryptToken, loadTokenEncryptionKey } from './token-crypto.ts'

export interface InterviewTurnView {
  sessionId: string
  assistantReply: string
  phase: Phase
  projectSummary: string | null
  projectTitle: string | null
  firedCheckpoint: boolean
  firedBreakdown: boolean
}

type InterviewTurnResult =
  | { ok: true } & InterviewTurnView
  | { ok: false; message: string }

// Shared by the actions' catch and the route's own catch — one failure
// copy, matching auth-result.ts's GENERIC_FAILURE pattern.
export const INTERVIEW_FAILURE = 'Something went wrong reaching the interviewer. Try again.'

// Issue #137: the turn calls with the user's own saved OpenRouter key
// when one is saved, otherwise the shared OPENROUTER_API_KEY. Decryption
// happens only here, at the point of calling the API (ADR-0002, same as
// the Todoist token); the pure precedence decision lives in
// resolveInterviewApiKey. Additive, not a replacement — the shared key
// stays the default.
async function loadLlm(userId: string) {
  const [userRow] = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const userKey = userRow?.openrouterApiKey
    ? decryptToken(userRow.openrouterApiKey, loadTokenEncryptionKey())
    : null
  const apiKey = resolveInterviewApiKey(userKey, process.env.OPENROUTER_API_KEY)
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set — see .env.example.')
  }
  return createOpenRouterClient({ apiKey, model: resolveInterviewModel(process.env) })
}

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

async function runTurn(
  userId: string,
  sessionId: string | null,
  message: string,
  createIfMissing: boolean,
): Promise<InterviewTurnResult> {
  let createdSessionId: string | null = null
  try {
    if (createIfMissing) {
      createdSessionId = await createSession(userId)
    }
    const sessionIdForTurn = createdSessionId ?? (await ownedSessionId(userId, sessionId))
    if (!sessionIdForTurn) {
      return { ok: false, message: 'That Interview could not be found.' }
    }
    const result = await runInterviewTurn(
      {
        llm: await loadLlm(userId),
        appendMessage: async (id, row) => {
          await db.insert(messages).values({ sessionId: id, ...row })
        },
        getTranscript: async (id) => {
          const rows = await db
            .select({
              role: messages.role,
              content: messages.content,
              toolName: messages.toolName,
              toolArgs: messages.toolArgs,
            })
            .from(messages)
            .where(eq(messages.sessionId, id))
            .orderBy(messages.createdAt)
          return rows.map((row) => ({
            role: row.role as 'user' | 'assistant' | 'tool',
            content: row.content,
            toolName: row.toolName,
            toolArgs: (row.toolArgs as Record<string, unknown> | null) ?? null,
          }))
        },
        updateSessionSummary: async (id, projectSummary) => {
          await db
            .update(interviewSessions)
            .set({ projectSummary })
            .where(eq(interviewSessions.id, id))
        },
        updateSessionTitle: async (id, projectTitle) => {
          await db
            .update(interviewSessions)
            .set({ projectTitle })
            .where(eq(interviewSessions.id, id))
        },
        saveProposedTasks: async (id, proposedTasks) => {
          if (proposedTasks.length > 0) {
            await db.insert(tasks).values(
              proposedTasks.map((task) => ({
                sessionId: id,
                title: task.title,
                description: task.description,
                priority: task.priority,
                dueString: task.dueString,
                position: task.position,
              })),
            )
          }
        },
      },
      sessionIdForTurn,
      message,
    )
    return { ok: true, sessionId: sessionIdForTurn, ...result }
  } catch {
    // Roll back this turn's writes so a retry starts clean: the user
    // message is persisted before the model call (never silently drop
    // what the user typed), but a failed turn must not leave a trailing
    // un-answered row behind — a retry would otherwise duplicate it in
    // the transcript. A failed start rolls back the whole Session row
    // (cascade deletes its messages) instead of orphaning one.
    if (createdSessionId) {
      await db
        .delete(interviewSessions)
        .where(eq(interviewSessions.id, createdSessionId))
    } else if (typeof sessionId === 'string') {
      await deleteTrailingUserMessage(sessionId, message)
    }
    return { ok: false, message: INTERVIEW_FAILURE }
  }
}

// Removes the just-persisted user message of a failed turn — matched by
// role and content so an older identical message is never touched.
async function deleteTrailingUserMessage(sessionId: string, content: string): Promise<void> {
  const [last] = await db
    .select({ id: messages.id, role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(desc(messages.createdAt))
    .limit(1)
  if (last && last.role === 'user' && last.content === content) {
    await db.delete(messages).where(eq(messages.id, last.id))
  }
}

async function createSession(userId: string): Promise<string> {
  const [row] = await db.insert(interviewSessions).values({ userId }).returning({ id: interviewSessions.id })
  if (!row) {
    throw new Error('Failed to create the Session row')
  }
  return row.id
}

export const startInterview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const result = parseInterviewMessage(input)
    if (!result.ok) {
      throw new Error(result.message)
    }
    return result.data
  })
  .handler(async ({ data }): Promise<InterviewTurnResult> => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) {
      return { ok: false, message: 'You need to log in before starting an Interview.' }
    }
    return runTurn(session.user.id, null, data.message, true)
  })

export const sendInterviewMessage = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const raw =
      typeof input === 'object' && input !== null
        ? (input as { message?: unknown; sessionId?: unknown })
        : { message: input, sessionId: undefined }
    const parsed = parseInterviewMessage(raw.message)
    if (!parsed.ok) {
      throw new Error(parsed.message)
    }
    if (typeof raw.sessionId !== 'string' || raw.sessionId.trim() === '') {
      throw new Error('Missing Interview reference — start a new Interview.')
    }
    return { message: parsed.data.message, sessionId: raw.sessionId }
  })
  .handler(async ({ data }): Promise<InterviewTurnResult> => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) {
      return { ok: false, message: 'You need to log in to continue the Interview.' }
    }
    return runTurn(session.user.id, data.sessionId, data.message, false)
  })

// --- Task Breakdown review/edit (issue #25) -------------------------------
//
// The review table's server functions. Editing and viewing only touches
// the local/persisted state — nothing here talks to Todoist yet; the
// confirm step arrives with the `create_todoist_tasks` ticket. Same
// shape as the actions above: auth via `auth.api`, ownership via
// `ownedSessionId`, raw errors never cross the wire.

export interface TaskRowView {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  dueString: string | null
  position: number
}

export type TaskBreakdownResult =
  | {
      ok: true
      phase: Phase
      projectTitle: string | null
      // The Todoist project created by the confirm step (issue #110) —
      // non-null exactly when the Phase is Completed. Already queried
      // for the Phase derivation; returned now so the Completed receipt
      // can link to the project.
      todoistProjectId: string | null
      tasks: Array<TaskRowView>
    }
  | { ok: false; message: string }

export type TaskActionResult = { ok: true } | { ok: false; message: string }

const TASK_FAILURE = 'Something went wrong saving that task. Try again.'

// Loads the proposed breakdown for the review table: the derived Phase,
// the cached project title, and the tasks in the order they were
// proposed. The Phase rides along (derived from the same inputs the
// History view uses — transcript tool rows plus `todoist_project_id`)
// so callers can tell a reviewable Session from one that is still being
// interviewed or has already been wrapped up.
export const getTaskBreakdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null || typeof (input as { sessionId?: unknown }).sessionId !== 'string') {
      throw new Error('Missing Interview reference.')
    }
    return { sessionId: (input as { sessionId: string }).sessionId }
  })
  .handler(async ({ data }): Promise<TaskBreakdownResult> => {
    try {
      const session = await auth.api.getSession({ headers: getRequestHeaders() })
      if (!session) {
        return { ok: false, message: 'You need to log in to review the task list.' }
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
      const toolRows = await db
        .select({ toolName: messages.toolName })
        .from(messages)
        .where(and(eq(messages.sessionId, sessionId), isNotNull(messages.toolName)))
      const rows = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          priority: tasks.priority,
          dueString: tasks.dueString,
          position: tasks.position,
        })
        .from(tasks)
        .where(eq(tasks.sessionId, sessionId))
        .orderBy(asc(tasks.position), asc(tasks.createdAt))
      return {
        ok: true,
        phase: derivePhase(toolRows, sessionRow?.todoistProjectId ?? null),
        projectTitle: sessionRow?.projectTitle ?? null,
        todoistProjectId: sessionRow?.todoistProjectId ?? null,
        tasks: rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          priority: toTaskPriority(row.priority),
          dueString: row.dueString,
          position: row.position,
        })),
      }
    } catch {
      return { ok: false, message: TASK_FAILURE }
    }
  })

// Shared validator for the table's add/edit payloads — the same parser
// the client runs for instant feedback, re-run here (never trust the
// wire).
function parseTaskEditPayload(input: unknown): TaskEditInput {
  const parsed = parseTaskEdit(input)
  if (!parsed.ok) {
    throw new Error(parsed.message)
  }
  return parsed.data
}

async function ownedTaskId(
  userId: string,
  sessionId: unknown,
  taskId: unknown,
): Promise<string | null> {
  const ownedSession = await editableSessionId(userId, sessionId)
  if (!ownedSession || typeof taskId !== 'string' || taskId.trim() === '') {
    return null
  }
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.sessionId, ownedSession)))
    .limit(1)
  return row?.id ?? null
}

// Editing the review table is part of the Proposed phase only (issue
// #25): once the Session is Completed — `todoist_project_id` set, the
// tasks already confirmed into Todoist — the list is frozen.
async function editableSessionId(userId: string, sessionId: unknown): Promise<string | null> {
  const ownedSession = await ownedSessionId(userId, sessionId)
  if (!ownedSession) {
    return null
  }
  const [row] = await db
    .select({ todoistProjectId: interviewSessions.todoistProjectId })
    .from(interviewSessions)
    .where(eq(interviewSessions.id, ownedSession))
    .limit(1)
  if (row?.todoistProjectId != null) {
    return null
  }
  return ownedSession
}

export const updateTaskInBreakdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const raw =
      typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
    const parsed = parseTaskEditPayload(raw)
    if (typeof raw.sessionId !== 'string' || typeof raw.taskId !== 'string') {
      throw new Error('Missing Interview or task reference.')
    }
    return { sessionId: raw.sessionId, taskId: raw.taskId, task: parsed }
  })
  .handler(async ({ data }): Promise<TaskActionResult> => {
    try {
      const session = await auth.api.getSession({ headers: getRequestHeaders() })
      if (!session) {
        return { ok: false, message: 'You need to log in to edit the task list.' }
      }
      const taskId = await ownedTaskId(session.user.id, data.sessionId, data.taskId)
      if (!taskId) {
        return { ok: false, message: 'That task could not be found.' }
      }
      await db
        .update(tasks)
        .set({
          title: data.task.title,
          description: data.task.description,
          priority: data.task.priority,
          dueString: data.task.dueString,
        })
        .where(eq(tasks.id, taskId))
      return { ok: true }
    } catch {
      return { ok: false, message: TASK_FAILURE }
    }
  })

export const addTaskToBreakdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const raw =
      typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
    const parsed = parseTaskEditPayload(raw)
    if (typeof raw.sessionId !== 'string') {
      throw new Error('Missing Interview reference.')
    }
    return { sessionId: raw.sessionId, task: parsed }
  })
  .handler(async ({ data }): Promise<TaskActionResult> => {
    try {
      const session = await auth.api.getSession({ headers: getRequestHeaders() })
      if (!session) {
        return { ok: false, message: 'You need to log in to edit the task list.' }
      }
      const sessionId = await editableSessionId(session.user.id, data.sessionId)
      if (!sessionId) {
        return { ok: false, message: 'That Interview could not be found.' }
      }
      const [row] = await db
        .select({ maxPosition: max(tasks.position) })
        .from(tasks)
        .where(eq(tasks.sessionId, sessionId))
      await db.insert(tasks).values({
        sessionId,
        title: data.task.title,
        description: data.task.description,
        priority: data.task.priority,
        dueString: data.task.dueString,
        position: (row?.maxPosition ?? -1) + 1,
      })
      return { ok: true }
    } catch {
      return { ok: false, message: TASK_FAILURE }
    }
  })

export const removeTaskFromBreakdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const raw =
      typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
    if (typeof raw.sessionId !== 'string' || typeof raw.taskId !== 'string') {
      throw new Error('Missing Interview or task reference.')
    }
    return { sessionId: raw.sessionId, taskId: raw.taskId }
  })
  .handler(async ({ data }): Promise<TaskActionResult> => {
    try {
      const session = await auth.api.getSession({ headers: getRequestHeaders() })
      if (!session) {
        return { ok: false, message: 'You need to log in to edit the task list.' }
      }
      const taskId = await ownedTaskId(session.user.id, data.sessionId, data.taskId)
      if (!taskId) {
        return { ok: false, message: 'That task could not be found.' }
      }
      await db.delete(tasks).where(eq(tasks.id, taskId))
      return { ok: true }
    } catch {
      return { ok: false, message: TASK_FAILURE }
    }
  })
