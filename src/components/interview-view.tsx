// The Interview conversation view (issue #24). Pure like the other form
// components — persistence and the model call arrive as an injected
// onSubmit, so the tests drive the whole conversation without a router,
// db, or network. The Checkpoint is never a screen of its own: once the
// summary exists it shows as a small persistent read-back hint
// (CONTEXT.md's Checkpoint entry). The Proposed-phase review table and
// the Completed wrapped-up state are delegated to TaskBreakdown
// (issue #54), which receives the answer form as its fallback children.
import { useState, type FormEvent } from 'react'

import type { Phase } from '../lib/phase.ts'
import type { TaskEditInput } from '../lib/task-input.ts'
import type { TaskActionResult, TaskRow } from './task-review.tsx'
import { TaskBreakdown } from './task-breakdown.tsx'

export interface InterviewMessage {
  role: 'user' | 'assistant'
  content: string
}

// Discriminated union: a failure always carries its message, so a
// failed submit can never render silently (plan.md §10).
export type InterviewSubmitResult = { ok: true } | { ok: false; message: string }

export interface InterviewViewProps {
  messages: ReadonlyArray<InterviewMessage>
  pending: boolean
  phase: Phase
  projectSummary: string | null
  // Present once `propose_task_breakdown` has fired (issue #25): the
  // Proposed phase swaps the conversation for the fully editable review
  // table — the product's actual AI-mistake-catching mechanism — before
  // anything is confirmed to Todoist.
  projectTitle?: string | null
  tasks?: ReadonlyArray<TaskRow>
  onUpdateTask?: (taskId: string, task: TaskEditInput) => Promise<TaskActionResult>
  onAddTask?: (task: TaskEditInput) => Promise<TaskActionResult>
  onRemoveTask?: (taskId: string) => Promise<TaskActionResult>
  // The confirm step (issue #26): fires create_todoist_tasks for the
  // reviewed breakdown. On success the caller moves the Phase to
  // Completed, which swaps this view to its wrapped-up state.
  onConfirmTask?: () => Promise<TaskActionResult>
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
  projectTitle = null,
  tasks,
  onUpdateTask,
  onAddTask,
  onRemoveTask,
  onConfirmTask,
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

      <TaskBreakdown
        phase={phase}
        projectTitle={projectTitle}
        tasks={tasks}
        pending={pending}
        onUpdateTask={onUpdateTask}
        onAddTask={onAddTask}
        onRemoveTask={onRemoveTask}
        onConfirmTask={onConfirmTask}
      >
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
      </TaskBreakdown>

      {started && (
        <p className="text-xs text-neutral-400">
          {phase === 'Defining'
            ? 'First, nailing down what the project actually is.'
            : phase === 'Proposed'
              ? 'Reviewing the proposed task list.'
              : phase === 'Completed'
                ? 'This Interview is wrapped up.'
                : 'Now drilling into concrete steps.'}
        </p>
      )}
    </main>
  )
}
