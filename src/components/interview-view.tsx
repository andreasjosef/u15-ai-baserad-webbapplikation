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
//
// Auto-scroll (issue #88): a newly appended message pulls the scroll
// region down only when the user was already reading at the bottom —
// judged by isNearBottom on the last scroll event and remembered in a
// ref, so the check happens before the new message renders. Someone
// scrolled up to reread is never yanked back down.
//
// Typing indicator (issue #89): while a turn is pending the reply's
// placeholder bubble — an animated three-dot pill in the interviewer's
// shape and fill — sits at the end of the message list where the reply
// will land, covering both the "Starting…" and "Thinking…" states.
//
// Composer (issue #90): the textarea starts at a single compact row and
// grows with its content (height to scrollHeight on every draft change,
// capped by max-h-48, scrolling internally past that), and Enter submits
// the form exactly like the send button — through the same handleSubmit
// guard — while Shift+Enter keeps its default newline. Enter that merely
// confirms an IME composition never submits.
//
// Composer polish (issue #134): the visible <label> above the textarea is
// gone in both states (the textarea's aria-label is the accessible name),
// and on a fine-pointer (desktop) device the textarea autofocuses on
// mount and is refocused after every submit — success or failure — via
// prefersFinePointer (src/lib/pointer.ts), so a coarse-pointer device's
// on-screen keyboard is never forced open unsolicited.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { ArrowUpIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { isNearBottom } from '../lib/scroll-near-bottom.ts'
import { prefersFinePointer } from '../lib/pointer.ts'
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

// Typing indicator (issue #89): the reply's placeholder bubble — the
// interviewer bubble's pill and fill, with three bouncing dots instead
// of text. Purely decorative: the composer's disabled send control is
// the accessible signal that a turn is pending.
const TYPING_INDICATOR_CLASS = `${INTERVIEWER_BUBBLE_CLASS} flex items-center gap-1.5 py-3`
const TYPING_DOT_CLASS = 'size-1.5 animate-bounce rounded-full bg-primary-foreground/70'

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-scroll (issue #88): the scrollable region and whether the user
  // was near its bottom at the last scroll event. Seeded true so the
  // very first message (before any scroll event can have fired) pulls
  // the conversation into view. Keyed on the message count, not the
  // array itself — a parent rebuilding an unchanged list must not
  // re-scroll (though opening an existing session does, which is wanted).
  const scrollRegionRef = useRef<HTMLElement | null>(null)
  const wasNearBottomRef = useRef(true)
  const messageCount = messages.length

  useEffect(() => {
    if (!wasNearBottomRef.current) {
      return
    }
    scrollRegionRef.current?.scrollTo({
      top: scrollRegionRef.current.scrollHeight,
    })
  }, [messageCount])

  // Auto-grow (issue #90): re-fit the textarea's height to its content on
  // every draft change — including the clear after a successful submit.
  // Resetting to auto first lets scrollHeight report the content's real
  // height; max-h-48 caps the growth and the textarea scrolls internally
  // past it, min-h-9 keeps the collapsed field at least as tall as the
  // send button beside it.
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea === null) {
      return
    }
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [draft])

  // Autofocus (issue #134): on a fine-pointer (desktop) device the
  // textarea takes focus on mount — the composer is the screen's one
  // input, so starting there saves a click. Gated through
  // `prefersFinePointer` so a coarse-pointer device never has its
  // on-screen keyboard forced open unsolicited.
  useEffect(() => {
    if (prefersFinePointer()) {
      textareaRef.current?.focus()
    }
  }, [])

  function refocusComposer() {
    if (prefersFinePointer()) {
      textareaRef.current?.focus()
    }
  }

  // Enter-to-send (issue #90): Enter submits the form — requestSubmit
  // lands in the same handleSubmit as the send button, so the
  // pending/empty-draft guard is shared rather than duplicated.
  // Shift+Enter falls through for its default newline, and so does an
  // Enter that only confirms an IME composition (isComposing, with
  // keyCode 229 as the legacy signal some IMEs emit instead).
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return
    }
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

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
      // Issue #134: after every submit — success or failure — a desktop
      // user is back in the composer, ready for the next question (focus
      // drifts during the await: the send button, a tab-away). On a
      // coarse-pointer device nothing is focused, per the same gate as
      // the mount autofocus.
      refocusComposer()
      if (result.breakdownProposed) {
        onBreakdownProposed()
      }
    } else {
      setError(result.message)
      refocusComposer()
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
          lives in the pinned footer below, outside this region. Its
          last scroll position decides whether a new message auto-scrolls
          (issue #88). */}
      <section
        ref={scrollRegionRef}
        onScroll={(event) => {
          const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
          wasNearBottomRef.current = isNearBottom({
            scrollTop,
            scrollHeight,
            clientHeight,
          })
        }}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {started || pending ? (
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
            {pending && (
              <li className={TYPING_INDICATOR_CLASS}>
                <span className={`${TYPING_DOT_CLASS} [animation-delay:-0.3s]`} />
                <span className={`${TYPING_DOT_CLASS} [animation-delay:-0.15s]`} />
                <span className={TYPING_DOT_CLASS} />
              </li>
            )}
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
          {/* Issue #134: the visible <label> above the field is gone in
              both states — the textarea's own aria-label is the
              accessible name, so nothing regresses. */}
          <div className={COMPOSER_CLASS}>
            <textarea
              id="idea"
              name="idea"
              ref={textareaRef}
              aria-label={started ? 'Your answer' : 'Your idea'}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                started ? undefined : 'e.g. I should really sort out the garage…'
              }
              className="max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
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
