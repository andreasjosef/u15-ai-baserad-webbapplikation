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
import { and, desc, eq } from 'drizzle-orm'

import { parseInterviewMessage } from '../interview-input.ts'
import type { Phase } from '../phase.ts'
import { auth } from '../auth.ts'
import { db } from './db/client.ts'
import { interviewSessions, messages } from './db/schema/index.ts'
import { runInterviewTurn } from './interview-turn.ts'
import {
  createOpenRouterClient,
  resolveInterviewModel,
} from './openrouter.ts'

export interface InterviewTurnView {
  sessionId: string
  assistantReply: string
  phase: Phase
  projectSummary: string | null
  firedCheckpoint: boolean
}

type InterviewTurnResult =
  | { ok: true } & InterviewTurnView
  | { ok: false; message: string }

// Shared by the actions' catch and the route's own catch — one failure
// copy, matching auth-result.ts's GENERIC_FAILURE pattern.
export const INTERVIEW_FAILURE = 'Something went wrong reaching the interviewer. Try again.'

function loadLlm() {
  const apiKey = process.env.OPENROUTER_API_KEY
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
        llm: loadLlm(),
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
