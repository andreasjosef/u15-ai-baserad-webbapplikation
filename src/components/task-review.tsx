// The Task Breakdown review table (issue #25) — the product's actual
// AI-mistake-catching mechanism (plan.md §8). Pure like the other form
// components: persistence arrives as injected callbacks returning a
// discriminated union, so the tests drive the whole editing flow
// without a router, db, or network.
//
// Fully editable before anything is confirmed: rename a task, change
// its priority or due date, add a task, or remove a task. Confirming
// (issue #26) fires the direct backend action `create_todoist_tasks`
// via the injected onConfirmTask — never a model tool call — and a
// failure leaves the table exactly as it was: confirming again is the
// retry. Priority uses the friendly enum everywhere. Text edits commit
// on blur (no server write per keystroke); the priority select commits
// on change. A title cleared to empty commits nothing and snaps back —
// the row always keeps a server-visible title.
import { useState, type ChangeEvent, type FocusEvent } from 'react'

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
  // whole reviewed breakdown. Optional so the table stays testable
  // without it; a failure renders as the same retryable alert.
  onConfirmTask?: () => Promise<TaskActionResult>
}

// Empty input means "cleared" — persisted as null rather than ''.
function cleared(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

type DraftField = 'title' | 'description' | 'dueString'

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
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
    void commitUpdate(task, {
      title: field === 'title' ? value : task.title,
      description: field === 'description' ? cleared(value) : task.description,
      priority: task.priority,
      dueString: field === 'dueString' ? cleared(value) : task.dueString,
    })
  }

  async function commitUpdate(task: TaskRow, next: TaskEditInput) {
    try {
      const result = await onUpdateTask(task.id, next)
      if (!result.ok) {
        setError(result.message)
      }
    } catch {
      setError('Something went wrong saving that task. Try again.')
    }
  }

  function changePriority(task: TaskRow, event: ChangeEvent<HTMLSelectElement>) {
    setError(null)
    void commitUpdate(task, {
      title: task.title,
      description: task.description,
      priority: event.target.value as TaskPriority,
      dueString: task.dueString,
    })
  }

  async function handleRemove(task: TaskRow) {
    setError(null)
    try {
      const result = await onRemoveTask(task.id)
      if (!result.ok) {
        setError(result.message)
      }
    } catch {
      setError('Something went wrong saving that task. Try again.')
    }
  }

  function handleDraftPriority(event: ChangeEvent<HTMLSelectElement>) {
    setDraft((previous) => ({ ...previous, priority: event.target.value as TaskPriority }))
  }

  async function handleAdd() {
    if (pending || draft.title.trim() === '') {
      return
    }
    setError(null)
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
        setError(result.message)
      }
    } catch {
      setError('Something went wrong saving that task. Try again.')
    }
  }

  function blurCommit(task: TaskRow, field: DraftField) {
    return (event: FocusEvent<HTMLInputElement>) => {
      event.preventDefault()
      commitEdit(task, field)
    }
  }

  // The confirm step (issue #26): one callback, no extra state — a
  // failure leaves the table untouched and the button re-enabled, so
  // confirming again is the retry.
  async function handleConfirm() {
    if (pending || onConfirmTask === undefined) {
      return
    }
    setError(null)
    try {
      const result = await onConfirmTask()
      if (!result.ok) {
        setError(result.message)
      }
    } catch {
      setError('Something went wrong creating your tasks in Todoist. Try again.')
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold tracking-tight">{projectTitle}</h2>
      <p className="text-sm text-neutral-500">
        Your task list is ready — rename anything, set priorities and due dates, add or remove tasks.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1 text-left font-medium">Title</th>
            <th scope="col" className="px-2 py-1 text-left font-medium">Description</th>
            <th scope="col" className="px-2 py-1 text-left font-medium">Priority</th>
            <th scope="col" className="px-2 py-1 text-left font-medium">Due</th>
            <th scope="col" className="px-2 py-1" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} aria-label={task.title} className="border-t border-neutral-200">
              <td className="px-2 py-1">
                <input
                  aria-label="Title"
                  value={editValue(task, 'title')}
                  onChange={(event) => setEdit(task, 'title', event.target.value)}
                  onBlur={blurCommit(task, 'title')}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  aria-label="Description"
                  value={editValue(task, 'description')}
                  onChange={(event) => setEdit(task, 'description', event.target.value)}
                  onBlur={blurCommit(task, 'description')}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1"
                />
              </td>
              <td className="px-2 py-1">
                <select
                  aria-label="Priority"
                  value={task.priority}
                  onChange={(event) => changePriority(task, event)}
                  className="rounded-md border border-neutral-300 px-2 py-1"
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1">
                <input
                  aria-label="Due date"
                  value={editValue(task, 'dueString')}
                  onChange={(event) => setEdit(task, 'dueString', event.target.value)}
                  onBlur={blurCommit(task, 'dueString')}
                  placeholder="e.g. this weekend"
                  className="w-full rounded-md border border-neutral-300 px-2 py-1"
                />
              </td>
              <td className="px-2 py-1 text-right">
                <button
                  type="button"
                  onClick={() => void handleRemove(task)}
                  aria-label={`Remove task ${task.title}`}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr aria-label="Add a task" className="border-t border-neutral-200">
            <td className="px-2 py-1">
              <input
                aria-label="Title"
                value={draft.title}
                onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="New task"
                className="w-full rounded-md border border-neutral-300 px-2 py-1"
              />
            </td>
            <td className="px-2 py-1">
              <input
                aria-label="Description"
                value={draft.description}
                onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="Optional note"
                className="w-full rounded-md border border-neutral-300 px-2 py-1"
              />
            </td>
            <td className="px-2 py-1">
              <select
                aria-label="Priority"
                value={draft.priority}
                onChange={handleDraftPriority}
                className="rounded-md border border-neutral-300 px-2 py-1"
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </td>
            <td className="px-2 py-1">
              <input
                aria-label="Due date"
                value={draft.dueString}
                onChange={(event) => setDraft((previous) => ({ ...previous, dueString: event.target.value }))}
                placeholder="e.g. tomorrow"
                className="w-full rounded-md border border-neutral-300 px-2 py-1"
              />
            </td>
            <td className="px-2 py-1 text-right">
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={pending || draft.title.trim() === ''}
                className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Add task
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
      {onConfirmTask && (
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={pending}
          className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Adding to Todoist…' : 'Add these tasks to Todoist'}
        </button>
      )}
    </section>
  )
}
