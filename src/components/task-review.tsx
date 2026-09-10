// The Task Breakdown review screen (issues #25, #69, #109) — the
// product's actual AI-mistake-catching mechanism (plan.md §8). Pure like
// the other form components: persistence arrives as injected callbacks
// returning a discriminated union, so the tests drive the whole editing
// flow without a router, db, or network.
//
// Direction C of prototype/task-breakdown-ending-107 (issue #107's
// verdict): tasks grouped into sections by priority — Urgent, High,
// Medium, Normal — each a rounded panel with a color dot, label, and
// pluralized count; empty sections don't render. A small `#n` chip per
// row keeps the original overall order traceable once tasks are split
// across sections (display only — persistence and the `position` column
// are untouched). The whole screen is one consistent stack of
// `rounded-xl border`/`bg-card` panels at max-w-2xl, header included.
// The grouping/color mapping lives in task-priority-groups.ts, shared
// with the Completed-screen receipt.
//
// Editing is unchanged, just relocated: rename a task (commits on
// blur), change its description or due date, change priority (commits
// on change, moving the row to its new section immediately), add a
// task (the trailing draft card, not grouped), or remove one. A failure
// renders as a retryable alert directly under the field that failed. A
// title cleared to empty commits nothing and snaps back — the row
// always keeps a server-visible title. Confirming (issue #26) fires the
// direct backend action `create_todoist_tasks` via the injected
// onConfirmTask — never a model tool call — and a failure leaves
// everything exactly as it was: confirming again is the retry.
import { useState, type ChangeEvent, type FocusEvent } from 'react'

import { XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { groupTasksByPriority, PRIORITY_META } from './task-priority-groups.ts'
import type { TaskEditInput, TaskPriority } from '../lib/task-input.ts'
import { TASK_PRIORITIES } from '../lib/task-input.ts'

export interface TaskRow {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  dueString: string | null
}

// Discriminated union: a failure always carries its message, so a
// failed edit can never render silently (plan.md §10).
export type TaskActionResult = { ok: true } | { ok: false; message: string }

export interface TaskReviewProps {
  projectTitle: string
  tasks: ReadonlyArray<TaskRow>
  pending: boolean
  onUpdateTask: (taskId: string, task: TaskEditInput) => Promise<TaskActionResult>
  onAddTask: (task: TaskEditInput) => Promise<TaskActionResult>
  onRemoveTask: (taskId: string) => Promise<TaskActionResult>
  // The confirm step (issue #26): fires create_todoist_tasks for the
  // whole reviewed breakdown. Optional so the screen stays testable
  // without it; a failure renders as the same retryable alert.
  onConfirmTask?: () => Promise<TaskActionResult>
}

// Empty input means "cleared" — persisted as null rather than ''.
function cleared(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

type DraftField = 'title' | 'description' | 'dueString'

// Where a failure happened, so its alert renders under the field that
// failed: `${taskId}:${field}`, the draft card, or the confirm button.
interface Failure {
  at: string
  message: string
}

// The one shadcn token the shared Input doesn't cover: the native
// priority <select>, styled to match it.
const PRIORITY_SELECT_CLASS =
  'h-8 rounded-lg border border-input bg-transparent px-2 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

// The shared priority field, identical in every task row and the draft
// card. The accessible name stays the aria-label it has always been.
function PriorityField({
  value,
  onChange,
}: {
  value: TaskPriority
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
}) {
  return (
    <select aria-label="Priority" value={value} onChange={onChange} className={PRIORITY_SELECT_CLASS}>
      {TASK_PRIORITIES.map((priority) => (
        <option key={priority} value={priority}>
          {PRIORITY_META[priority].label}
        </option>
      ))}
    </select>
  )
}

function FailureAlert({ message }: { message: string }) {
  return <p role="alert" className="text-xs text-destructive">{message}</p>
}

export function TaskReview({
  projectTitle,
  tasks,
  pending,
  onUpdateTask,
  onAddTask,
  onRemoveTask,
  onConfirmTask,
}: TaskReviewProps) {
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    priority: 'normal' as TaskPriority,
    dueString: '',
  })
  // Uncommitted text edits, keyed `${taskId}:${field}` — the row keeps
  // typing locally until blur, then one edit fires.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<Failure | null>(null)

  function editValue(task: TaskRow, field: DraftField): string {
    const key = `${task.id}:${field}`
    const override = edits[key]
    if (override !== undefined) {
      return override
    }
    return field === 'title' ? task.title : (task[field] ?? '')
  }

  function setEdit(task: TaskRow, field: DraftField, value: string) {
    const key = `${task.id}:${field}`
    setEdits((previous) => ({ ...previous, [key]: value }))
  }

  // One commit per blur. An emptied title never fires — the row keeps
  // its last committed title instead of persisting a broken task.
  function commitEdit(task: TaskRow, field: DraftField) {
    const key = `${task.id}:${field}`
    const value = edits[key]
    if (value === undefined) {
      return
    }
    setEdits((previous) => {
      const { [key]: _committed, ...rest } = previous
      return rest
    })
    if (field === 'title' && value.trim() === '') {
      return
    }
    setFailure(null)
    void commitUpdate(task, `${task.id}:${field}`, {
      title: field === 'title' ? value : task.title,
      description: field === 'description' ? cleared(value) : task.description,
      priority: task.priority,
      dueString: field === 'dueString' ? cleared(value) : task.dueString,
    })
  }

  async function commitUpdate(task: TaskRow, at: string, next: TaskEditInput) {
    try {
      const result = await onUpdateTask(task.id, next)
      if (!result.ok) {
        setFailure({ at, message: result.message })
      }
    } catch {
      setFailure({ at, message: 'Something went wrong saving that task. Try again.' })
    }
  }

  function changePriority(task: TaskRow, event: ChangeEvent<HTMLSelectElement>) {
    setFailure(null)
    void commitUpdate(task, `${task.id}:priority`, {
      title: task.title,
      description: task.description,
      priority: event.target.value as TaskPriority,
      dueString: task.dueString,
    })
  }

  async function handleRemove(task: TaskRow) {
    setFailure(null)
    try {
      const result = await onRemoveTask(task.id)
      if (!result.ok) {
        setFailure({ at: `${task.id}:remove`, message: result.message })
      }
    } catch {
      setFailure({ at: `${task.id}:remove`, message: 'Something went wrong saving that task. Try again.' })
    }
  }

  function handleDraftPriority(event: ChangeEvent<HTMLSelectElement>) {
    setDraft((previous) => ({ ...previous, priority: event.target.value as TaskPriority }))
  }

  async function handleAdd() {
    if (pending || draft.title.trim() === '') {
      return
    }
    setFailure(null)
    try {
      const result = await onAddTask({
        title: draft.title,
        description: cleared(draft.description),
        priority: draft.priority,
        dueString: cleared(draft.dueString),
      })
      if (result.ok) {
        setDraft({ title: '', description: '', priority: 'normal', dueString: '' })
      } else {
        setFailure({ at: 'draft', message: result.message })
      }
    } catch {
      setFailure({ at: 'draft', message: 'Something went wrong saving that task. Try again.' })
    }
  }

  function blurCommit(task: TaskRow, field: DraftField) {
    return (event: FocusEvent<HTMLInputElement>) => {
      event.preventDefault()
      commitEdit(task, field)
    }
  }

  // The confirm step (issue #26): one callback, no extra state — a
  // failure leaves the sections untouched and the button re-enabled, so
  // confirming again is the retry.
  async function handleConfirm() {
    if (pending || onConfirmTask === undefined) {
      return
    }
    setFailure(null)
    try {
      const result = await onConfirmTask()
      if (!result.ok) {
        setFailure({ at: 'confirm', message: result.message })
      }
    } catch {
      setFailure({ at: 'confirm', message: 'Something went wrong creating your tasks in Todoist. Try again.' })
    }
  }

  const groups = groupTasksByPriority(tasks)
  // The `#n` chip is display only: each task's 1-based index in the
  // flat, ungrouped list, recomputed from the tasks prop every render.
  const overallOrder = new Map(tasks.map((task, index) => [task.id, index + 1]))

  function editRow(task: TaskRow) {
    return (
      <li key={task.id} aria-label={task.title} className="flex flex-col gap-2 p-3 text-sm">
        <div className="flex items-end gap-2">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
          >
            #{overallOrder.get(task.id)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <input
              aria-label="Title"
              value={editValue(task, 'title')}
              onChange={(event) => setEdit(task, 'title', event.target.value)}
              onBlur={blurCommit(task, 'title')}
              className="min-w-0 bg-transparent font-medium outline-none"
            />
            {failure?.at === `${task.id}:title` && <FailureAlert message={failure.message} />}
          </div>
          <div className="flex flex-col gap-1">
            <PriorityField value={task.priority} onChange={(event) => changePriority(task, event)} />
            {failure?.at === `${task.id}:priority` && <FailureAlert message={failure.message} />}
          </div>
          <div className="flex w-36 flex-col gap-1">
            <Input
              aria-label="Due date"
              value={editValue(task, 'dueString')}
              onChange={(event) => setEdit(task, 'dueString', event.target.value)}
              onBlur={blurCommit(task, 'dueString')}
              placeholder="e.g. this weekend"
            />
            {failure?.at === `${task.id}:dueString` && <FailureAlert message={failure.message} />}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => void handleRemove(task)}
            aria-label={`Remove task ${task.title}`}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <Input
            aria-label="Description"
            value={editValue(task, 'description')}
            onChange={(event) => setEdit(task, 'description', event.target.value)}
            onBlur={blurCommit(task, 'description')}
            placeholder="Add a description…"
          />
          {failure?.at === `${task.id}:description` && <FailureAlert message={failure.message} />}
        </div>
        {failure?.at === `${task.id}:remove` && <FailureAlert message={failure.message} />}
      </li>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      {/* The header panel: same rounded-card treatment as every priority
          section, so the screen reads as one stack of panels. */}
      <header className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3">
        <h2 className="text-xl font-bold tracking-tight">{projectTitle}</h2>
        <p className="text-sm text-muted-foreground">
          Your task list is ready — rename anything, set priorities and due dates, add or remove tasks.
        </p>
      </header>
      <div className="flex flex-col gap-4">
        {groups.map(({ priority, tasks: rows }) => (
          <section
            key={priority}
            aria-label={PRIORITY_META[priority].label}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span aria-hidden="true" className={`size-2 rounded-full ${PRIORITY_META[priority].dot}`} />
              <h3 className={`text-sm font-semibold ${PRIORITY_META[priority].text}`}>
                {PRIORITY_META[priority].label}
              </h3>
              <span className="text-xs text-muted-foreground">
                {rows.length} task{rows.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul role="list" className="flex list-none flex-col divide-y divide-border p-0">
              {rows.map(editRow)}
            </ul>
          </section>
        ))}
      </div>
      {/* The trailing draft card, visually distinct and not grouped into
          any section: dashed border, muted background. */}
      <div
        role="group"
        aria-label="Add a task"
        className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/50 p-3 text-sm"
      >
        <div className="flex items-end gap-2">
          <Input
            aria-label="Title"
            value={draft.title}
            onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))}
            placeholder="New task"
            className="min-w-0 flex-1"
          />
          <PriorityField value={draft.priority} onChange={handleDraftPriority} />
          <Input
            aria-label="Due date"
            value={draft.dueString}
            onChange={(event) => setDraft((previous) => ({ ...previous, dueString: event.target.value }))}
            placeholder="e.g. tomorrow"
            className="w-36"
          />
        </div>
        <Input
          aria-label="Description"
          value={draft.description}
          onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
          placeholder="Optional note"
        />
        {failure?.at === 'draft' && <FailureAlert message={failure.message} />}
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleAdd()}
          disabled={pending || draft.title.trim() === ''}
          className="self-start"
        >
          Add task
        </Button>
      </div>
      {onConfirmTask && (
        <>
          <Button type="button" onClick={() => void handleConfirm()} disabled={pending} className="self-start">
            {pending ? 'Adding to Todoist…' : 'Add these tasks to Todoist'}
          </Button>
          {failure?.at === 'confirm' && <FailureAlert message={failure.message} />}
        </>
      )}
    </section>
  )
}
