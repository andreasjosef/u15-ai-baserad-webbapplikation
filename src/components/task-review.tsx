// The Task Breakdown review cards (issues #25, #69) — the product's
// actual AI-mistake-catching mechanism (plan.md §8). Pure like the other
// form components: persistence arrives as injected callbacks returning a
// discriminated union, so the tests drive the whole editing flow without
// a router, db, or network.
//
// Mockup 3's card treatment, one card per **task** (this component only
// ever reviews one project at a time): a colored header band holding the
// task title as a live input plus a remove control, and a plain
// edit-form body — no checklist/checkbox iconography. A failure renders
// as a retryable alert directly under the field that failed. Fully
// editable before anything is confirmed: rename a task, change its
// priority or due date, add a task, or remove a task. Confirming
// (issue #26) fires the direct backend action `create_todoist_tasks`
// via the injected onConfirmTask — never a model tool call — and a
// failure leaves the cards exactly as they were: confirming again is
// the retry. Priority uses the friendly enum everywhere. Text edits
// commit on blur (no server write per keystroke); the priority select
// commits on change. A title cleared to empty commits nothing and snaps
// back — the card always keeps a server-visible title.
import { useState, type ChangeEvent, type FocusEvent } from 'react'

import { XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  // whole reviewed breakdown. Optional so the cards stay testable
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

// The shared priority field, identical in every task card and the draft
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
          {priority}
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
  // Uncommitted text edits, keyed `${taskId}:${field}` — the card keeps
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

  // One commit per blur. An emptied title never fires — the card keeps
  // its last committed title instead of persisting a broken row.
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
  // failure leaves the cards untouched and the button re-enabled, so
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

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">{projectTitle}</h2>
        <p className="text-sm text-muted-foreground">
          Your task list is ready — rename anything, set priorities and due dates, add or remove tasks.
        </p>
      </header>
      <ul role="list" className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            aria-label={task.title}
            className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
          >
            {/* Card header band: the live title input plus the remove
                control, on the mockup's sampled purple (--primary). The
                raw input (not the shared Input) keeps the band showing
                through — the same field, restyled in place. */}
            <div className="flex items-center gap-2 bg-primary px-3 py-2 text-primary-foreground">
              <input
                aria-label="Title"
                value={editValue(task, 'title')}
                onChange={(event) => setEdit(task, 'title', event.target.value)}
                onBlur={blurCommit(task, 'title')}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => void handleRemove(task)}
                aria-label={`Remove task ${task.title}`}
                className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
            {/* Card body: a plain edit form — no checklist iconography.
                Each failure alert renders directly under its field. */}
            <div className="flex flex-col gap-3 p-3 text-sm">
              {failure?.at === `${task.id}:title` && <FailureAlert message={failure.message} />}
              <Input
                aria-label="Description"
                value={editValue(task, 'description')}
                onChange={(event) => setEdit(task, 'description', event.target.value)}
                onBlur={blurCommit(task, 'description')}
                placeholder="Add a description…"
              />
              {failure?.at === `${task.id}:description` && <FailureAlert message={failure.message} />}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <PriorityField
                    value={task.priority}
                    onChange={(event) => changePriority(task, event)}
                  />
                  {failure?.at === `${task.id}:priority` && <FailureAlert message={failure.message} />}
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    aria-label="Due date"
                    value={editValue(task, 'dueString')}
                    onChange={(event) => setEdit(task, 'dueString', event.target.value)}
                    onBlur={blurCommit(task, 'dueString')}
                    placeholder="e.g. this weekend"
                  />
                  {failure?.at === `${task.id}:dueString` && <FailureAlert message={failure.message} />}
                </div>
              </div>
              {failure?.at === `${task.id}:remove` && <FailureAlert message={failure.message} />}
            </div>
          </li>
        ))}
        {/* Trailing draft card, visually distinct from the real task
            cards: dashed border, muted background, no purple header. */}
        <li
          aria-label="Add a task"
          className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/50 p-3"
        >
          <Input
            aria-label="Title"
            value={draft.title}
            onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))}
            placeholder="New task"
          />
          <Input
            aria-label="Description"
            value={draft.description}
            onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="Optional note"
          />
          <div className="grid grid-cols-2 gap-3">
            <PriorityField value={draft.priority} onChange={handleDraftPriority} />
            <Input
              aria-label="Due date"
              value={draft.dueString}
              onChange={(event) => setDraft((previous) => ({ ...previous, dueString: event.target.value }))}
              placeholder="e.g. tomorrow"
            />
          </div>
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
        </li>
      </ul>
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
