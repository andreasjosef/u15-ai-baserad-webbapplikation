// PROTOTYPE, throw away — the Task Breakdown review's edit/commit logic
// (issue #107, see prototype/README.md), lifted out of task-review.tsx
// unchanged and shared by all three layout variants in
// prototype-task-ending-variants.tsx. The issue is explicit that this is
// "a layout/density question, not a functionality change" — every field
// still commits on blur, priority commits on change, an emptied title
// snaps back uncommitted, and a failure is reported by a
// `${taskId}:${field}` key so each variant can render it under whatever
// field markup it chooses. Sharing this (not the JSX) mirrors how the
// home-redesign prototype shared AuthForm's validation logic across its
// three directions instead of forking it three times.
import { useState, type ChangeEvent, type FocusEvent } from 'react'

import type { TaskEditInput, TaskPriority } from '../lib/task-input.ts'
import type { TaskActionResult, TaskRow } from './task-review.tsx'

export type DraftField = 'title' | 'description' | 'dueString'

export interface EditFailure {
  at: string
  message: string
}

function cleared(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export interface TaskEndingEditingProps {
  pending: boolean
  onUpdateTask: (taskId: string, task: TaskEditInput) => Promise<TaskActionResult>
  onAddTask: (task: TaskEditInput) => Promise<TaskActionResult>
  onRemoveTask: (taskId: string) => Promise<TaskActionResult>
  onConfirmTask?: () => Promise<TaskActionResult>
}

export function useTaskEndingEditing({
  pending,
  onUpdateTask,
  onAddTask,
  onRemoveTask,
  onConfirmTask,
}: TaskEndingEditingProps) {
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    priority: 'normal' as TaskPriority,
    dueString: '',
  })
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<EditFailure | null>(null)

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

  function blurCommit(task: TaskRow, field: DraftField) {
    return (event: FocusEvent<HTMLInputElement>) => {
      event.preventDefault()
      commitEdit(task, field)
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

  function setDraftField(field: DraftField, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }))
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

  return {
    draft,
    setDraftField,
    handleDraftPriority,
    handleAdd,
    editValue,
    setEdit,
    blurCommit,
    changePriority,
    handleRemove,
    handleConfirm,
    failure,
  }
}
