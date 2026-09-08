// The History view (issue #27): a flat, chronological, read-only list of
// the user's past Interviews. Pure like the other components — the
// expanded row's transcript and task breakdown arrive through an
// injected onOpenSession loader, so this renders without a router, db,
// or network.
//
// Accordion, not a separate detail page or modal: clicking a row expands
// it in place, one row expanded at a time, and the loaded detail is
// cached per row so re-expanding never re-fetches. Inside the expanded
// row a Transcript / Task Breakdown tab switch shows the stored Q&A or
// the resulting task list — rendered read-only everywhere. Every Phase
// shows, including Defining/Drilling/Proposed, but nothing here offers a
// Continue/Resume entry point back into the Interview (plan.md §13's
// single-sitting decision) — an abandoned Interview is simply restarted
// as a brand-new Session. A failed load renders as a retryable alert;
// clicking the row again is the retry (plan.md §10).
import { useState, type MouseEvent } from 'react'

import type { HistorySessionRow } from '../lib/history.ts'
import type { Phase } from '../lib/phase.ts'

export type { HistorySessionRow } from '../lib/history.ts'

export interface HistoryTranscriptMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface HistoryTask {
  title: string
  description: string | null
  priority: string | null
  dueString: string | null
}

export interface HistoryDetail {
  projectTitle: string | null
  projectSummary: string | null
  transcript: ReadonlyArray<HistoryTranscriptMessage>
  tasks: ReadonlyArray<HistoryTask>
}

// Discriminated union: a failed load always carries its message, so a
// failed expand can never render silently (plan.md §10).
export type HistoryDetailResult = { ok: true; detail: HistoryDetail } | { ok: false; message: string }

export interface HistoryViewProps {
  sessions: ReadonlyArray<HistorySessionRow>
  onOpenSession: (sessionId: string) => Promise<HistoryDetailResult>
}

const DETAIL_FAILURE = 'Something went wrong loading that interview. Try again.'

function sessionLabel(session: HistorySessionRow): string {
  return session.projectTitle ?? session.projectSummary ?? 'Untitled interview'
}

function taskCountLabel(taskCount: number): string {
  return taskCount === 0 ? 'No tasks' : taskCount === 1 ? '1 task' : `${taskCount} tasks`
}

// Creation date only — the stored Session timestamps are internal, and
// the row has no other date surface (issue #27).
function formatCreatedAt(createdAt: Date): string {
  return createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const PHASE_BADGE_STYLES: Record<Phase, string> = {
  Defining: 'bg-neutral-100 text-neutral-600',
  Drilling: 'bg-neutral-100 text-neutral-600',
  Proposed: 'bg-neutral-800 text-white',
  Completed: 'bg-neutral-900 text-white',
}

type Tab = 'transcript' | 'breakdown'

export function HistoryView({ sessions, onOpenSession }: HistoryViewProps) {
  // One expanded row at a time — the accordion id, null when collapsed.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Loaded detail cached per row id, so re-expanding never re-fetches.
  const [details, setDetails] = useState<Record<string, HistoryDetail>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('transcript')

  async function toggle(sessionId: string) {
    if (expandedId === sessionId) {
      setExpandedId(null)
      setError(null)
      return
    }
    setExpandedId(sessionId)
    setTab('transcript')
    setError(null)
    if (details[sessionId] !== undefined) {
      return
    }
    setLoadingId(sessionId)
    try {
      const result = await onOpenSession(sessionId)
      if (result.ok) {
        setDetails((previous) => ({ ...previous, [sessionId]: result.detail }))
      } else {
        setExpandedId(null)
        setError(result.message)
      }
    } catch {
      setExpandedId(null)
      setError(DETAIL_FAILURE)
    } finally {
      setLoadingId(null)
    }
  }

  // The whole row is one click target. The visible header button and the
  // row itself both land here via the row handler; clicks inside the
  // expanded detail (tabs, transcript) never toggle the row.
  function handleRowClick(sessionId: string, event: MouseEvent) {
    const target = event.target as HTMLElement
    if (target.closest('[role="tab"]') !== null || target.closest('[data-detail]') !== null) {
      return
    }
    void toggle(sessionId)
  }

  if (sessions.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
        </header>
        <p className="text-sm text-neutral-500">
          No interviews yet — start one from the home page.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-neutral-500">
          Your past interviews, newest first — read-only.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {sessions.map((session) => {
          const expanded = expandedId === session.sessionId
          const detail = details[session.sessionId]
          return (
            <li
              key={session.sessionId}
              aria-label={sessionLabel(session)}
              className="rounded-md border border-neutral-200 hover:bg-neutral-50"
              onClick={(event) => handleRowClick(session.sessionId, event)}
            >
              <button
                type="button"
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="flex-1 truncate text-sm font-medium">
                  {sessionLabel(session)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_BADGE_STYLES[session.phase]}`}
                >
                  {session.phase}
                </span>
                <span className="text-xs text-neutral-500">
                  {formatCreatedAt(session.createdAt)}
                </span>
                <span className="text-xs text-neutral-500">
                  {taskCountLabel(session.taskCount)}
                </span>
              </button>

              {expanded && (
                <div data-detail className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-3">
                  {loadingId === session.sessionId && (
                    <p role="status" className="text-sm text-neutral-500">
                      Loading…
                    </p>
                  )}
                  {detail && (
                    <>
                      <div role="tablist" aria-label="Interview detail" className="flex gap-2">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={tab === 'transcript'}
                          onClick={() => setTab('transcript')}
                          className={`rounded-md border border-neutral-300 px-3 py-1 text-sm ${tab === 'transcript' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'}`}
                        >
                          Transcript
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={tab === 'breakdown'}
                          onClick={() => setTab('breakdown')}
                          className={`rounded-md border border-neutral-300 px-3 py-1 text-sm ${tab === 'breakdown' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'}`}
                        >
                          Task Breakdown
                        </button>
                      </div>

                      {tab === 'transcript' ? (
                        <div role="tabpanel" aria-label="Transcript" className="flex flex-col gap-2">
                          {detail.transcript.map((message, index) => (
                            <p
                              key={index}
                              className={
                                message.role === 'user'
                                  ? 'self-end rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white'
                                  : 'self-start rounded-lg bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900'
                              }
                            >
                              {message.content}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <div role="tabpanel" aria-label="Task Breakdown" className="flex flex-col gap-2">
                          {detail.projectTitle !== null && (
                            <p className="text-sm font-medium">{detail.projectTitle}</p>
                          )}
                          <ul className="flex flex-col gap-2">
                            {detail.tasks.map((task, index) => (
                              <li key={index} className="text-sm">
                                <span className="font-medium">{task.title}</span>
                                {task.description !== null && (
                                  <span className="text-neutral-500"> — {task.description}</span>
                                )}
                                {task.priority !== null && (
                                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                                    {task.priority}
                                  </span>
                                )}
                                {task.dueString !== null && (
                                  <span className="ml-2 text-xs text-neutral-500">Due {task.dueString}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </main>
  )
}
