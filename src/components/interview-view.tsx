// The Interview conversation view (issue #24). Pure like the other form
// components — persistence and the model call arrive as an injected
// onSubmit, so the tests drive the whole conversation without a router,
// db, or network. The Checkpoint is never a screen of its own: once the
// summary exists it shows as a small persistent read-back hint
// (CONTEXT.md's Checkpoint entry).
//
// This view only hosts the Defining and Drilling phases. The moment a
// turn proposes a Task Breakdown (issue #56), the conversation route
// navigates away to the review route (issue #55) — that navigation is
// injected here as onBreakdownProposed, and this view stops rendering
// (and its route stops fetching) the review table and wrapped-up state
// entirely.
import { useState, type FormEvent } from 'react'

import type { Phase } from '../lib/phase.ts'

export interface InterviewMessage {
  role: 'user' | 'assistant'
  content: string
}

// Discriminated union: a failure always carries its message, so a
// failed submit can never render silently (plan.md §10). A success
// carries whether that turn proposed a Task Breakdown, which is this
// view's cue to hand off to the review route (issue #56).
export type InterviewSubmitResult =
  | { ok: true; breakdownProposed?: boolean }
  | { ok: false; message: string }

export interface InterviewViewProps {
  messages: ReadonlyArray<InterviewMessage>
  pending: boolean
  phase: Phase
  projectSummary: string | null
  // Fired after a turn whose result indicates a Task Breakdown was
  // proposed — the conversation route performs a real navigation to the
  // review route (issue #55), addressed by the Session's id. This view
  // holds no breakdown data of its own.
  onBreakdownProposed: () => void
  // Returns ok:false with nothing rendered — the failure message is
  // shown by this component as a retryable alert, and the typed message
  // stays in the box (plan.md §10 — no silent failures).
  onSubmit: (message: string) => Promise<InterviewSubmitResult>
}

export function InterviewView({
  messages,
  pending,
  phase,
  projectSummary,
  onBreakdownProposed,
  onSubmit,
}: InterviewViewProps) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const started = messages.length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || draft.trim() === '') {
      return
    }
    const message = draft
    setError(null)
    const result = await onSubmit(message)
    if (result.ok) {
      setDraft('')
      if (result.breakdownProposed) {
        onBreakdownProposed()
      }
    } else {
      setError(result.message)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Hone</h1>
        <p className="text-sm text-neutral-500">
          {started
            ? 'One question at a time — answer as loosely as you like.'
            : 'What is the idea you have been meaning to get to?'}
        </p>
      </header>

      {projectSummary !== null && (
        <p
          role="status"
          className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
        >
          Sounds like the project is: {projectSummary} — let&apos;s break that into steps.
        </p>
      )}

      {messages.length > 0 && (
        <ol className="flex flex-col gap-3">
          {messages.map((message, index) => (
            <li
              key={index}
              className={
                message.role === 'user'
                  ? 'self-end rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white'
                  : 'self-start rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-900'
              }
            >
              {message.content}
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {started ? 'Your answer' : 'Your vague idea'}
          <textarea
            name="idea"
            aria-label={started ? 'Your answer' : 'Your idea'}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder={
              started ? undefined : 'e.g. I should really sort out the garage…'
            }
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || draft.trim() === ''}
          className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? (started ? 'Thinking…' : 'Starting…') : started ? 'Send' : 'Start the interview'}
        </button>
      </form>

      {started && (
        <p className="text-xs text-neutral-400">
          {phase === 'Defining'
            ? 'First, nailing down what the project actually is.'
            : 'Now drilling into concrete steps.'}
        </p>
      )}
    </main>
  )
}
