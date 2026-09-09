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
//
// Styling (issue #67): the conversation adopts the shared design tokens
// and shadcn primitives, so it reads as part of the same product as the
// rest of the nav shell. Conversation bubbles are the brand purple for the
// interviewer and a plain outlined card for the user; the composer is a
// rounded field with a circular send control; the Checkpoint hint is a
// gently tinted note rather than a leftover unstyled box. Every prop,
// callback, accessible name/role and keyboard path is unchanged from
// before the restyle — only markup and class names moved.
//
// Layout (issue #87): the view is a full-height conversation layout — the page's
// own heading and subtitle are gone, a centered `What should we Hone?`
// invitation fills the scroll region before the first message, and the
// Checkpoint hint, composer, retry alert, and phase footnote are pinned
// in a footer outside the scrolling region. No prop, callback, accessible
// name/role or keyboard path changed here either.
import { useState, type FormEvent } from 'react'

import { ArrowUpIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

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

// Shared conversation-bubble shape — only the side, the squared corner,
// and the fill tell the interviewer's turns apart from the user's.
const BUBBLE_BASE_CLASS = 'max-w-[85%] rounded-2xl px-4 py-2 text-sm'
const INTERVIEWER_BUBBLE_CLASS = `${BUBBLE_BASE_CLASS} self-start rounded-bl-sm bg-primary text-primary-foreground`
const USER_BUBBLE_CLASS = `${BUBBLE_BASE_CLASS} self-end rounded-br-sm border border-border bg-card text-card-foreground`

// The composer wrapper mirrors the focus treatment `ui/input.tsx` gives
// the shared Input (border-ring plus a ring on focus) — expressed with
// focus-within, since there is no shadcn Textarea primitive to compose
// and this field is multi-line.
const COMPOSER_CLASS =
  'flex items-end gap-2 rounded-2xl border border-input bg-card p-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50'

// Layout (issue #87): a full-height conversation layout — the screen is one
// scrolling conversation region with everything else pinned in a footer
// beneath it. `h-full` fills the nav shell's height-bound content wrapper
// (issue #86) so the scroll region inside can actually bound.
const ROOT_CLASS = 'mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-6'

// The invitation a brand-new Interview opens with. Capital H — "Hone" is
// the app's name, brand usage. Gated on `started` only, so it stays up
// while the user is still drafting their first message.
const EMPTY_STATE_CLASS = 'text-lg font-medium text-muted-foreground'

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

  // The submit control's accessible name is unchanged from before the
  // restyle: it is only ever rendered as an icon now, so the label moves
  // to aria-label verbatim.
  const submitLabel = pending
    ? started
      ? 'Thinking…'
      : 'Starting…'
    : started
      ? 'Send'
      : 'Start the interview'

  return (
    <main className={ROOT_CLASS}>
      {/* The scrolling region: the empty-state invitation before the
          first message, then the conversation itself. Everything else
          lives in the pinned footer below, outside this region. */}
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {started ? (
          <ol className="flex flex-col gap-3">
            {messages.map((message, index) => (
              <li
                key={index}
                className={
                  message.role === 'user'
                    ? USER_BUBBLE_CLASS
                    : INTERVIEWER_BUBBLE_CLASS
                }
              >
                {message.content}
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className={EMPTY_STATE_CLASS}>What should we Hone?</p>
          </div>
        )}
      </section>

      {/* The pinned footer: the Checkpoint hint, the composer (with its
          inline retry alert), and the phase footnote — all retained from
          today, just fixed at the bottom instead of scrolling away. */}
      <footer className="flex flex-col gap-2 pt-2">
        {projectSummary !== null && (
          <p
            role="status"
            className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground"
          >
            Sounds like the project is: {projectSummary} — let&apos;s break that into steps.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="idea" className="text-sm font-medium">
            {started ? 'Your answer' : 'Your vague idea'}
          </label>
          <div className={COMPOSER_CLASS}>
            <textarea
              id="idea"
              name="idea"
              aria-label={started ? 'Your answer' : 'Your idea'}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              placeholder={
                started ? undefined : 'e.g. I should really sort out the garage…'
              }
              className="max-h-48 min-h-16 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="icon"
              aria-label={submitLabel}
              disabled={pending || draft.trim() === ''}
              className="shrink-0 rounded-full"
            >
              <ArrowUpIcon aria-hidden="true" />
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        {started && (
          <p className="text-xs text-muted-foreground">
            {phase === 'Defining'
              ? 'First, nailing down what the project actually is.'
              : 'Now drilling into concrete steps.'}
          </p>
        )}
      </footer>
    </main>
  )
}
