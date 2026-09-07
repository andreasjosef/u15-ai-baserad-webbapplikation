// Shared validation for the Task Breakdown (issue #25) — the friendly
// priority enum plus the parsers behind the model's
// `propose_task_breakdown` call and the review table's edits. Parsed on
// the server when the tool call arrives, and again inside the
// server-function validators behind the table's edits (never trust the
// wire) — same function, same rules, mirroring interview-input.ts.
//
// Priority uses the friendly "normal" | "medium" | "high" | "urgent"
// enum everywhere in the UI and storage; the mapping to Todoist's
// inverted 1-4 integers happens at the Todoist API boundary, in the
// ticket that talks to Todoist (plan.md §5).
import type { ParsedCredentials } from './auth-input.ts'

const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_DUE_STRING_LENGTH = 100
const MAX_TASKS = 100

export const TASK_PRIORITIES = ['normal', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

function isPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && (TASK_PRIORITIES as readonly string[]).includes(value)
}

// The `tasks.priority` column is plain text, app-validated (issue #6) —
// this coercion keeps a value the app never wrote from reaching the UI
// or the later Todoist mapping as a bogus enum.
export function toTaskPriority(value: unknown): TaskPriority {
  return isPriority(value) ? value : 'normal'
}

function optionalText(value: unknown, maxLength: number): string | null | 'too_long' {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  return trimmed.length > maxLength ? 'too_long' : trimmed
}

// One row of the proposed breakdown, normalized: optional fields default
// to null, priority defaults to "normal", so persisted rows are uniform.
export interface TaskEditInput {
  title: string
  description: string | null
  priority: TaskPriority
  dueString: string | null
}

export function parseTaskEdit(input: unknown): ParsedCredentials<TaskEditInput> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, message: 'Give the task a title.' }
  }
  const raw = input as Record<string, unknown>
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (title === '') {
    return { ok: false, message: 'Give the task a title.' }
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, message: `Keep the title under ${MAX_TITLE_LENGTH} characters.` }
  }
  const priority = raw.priority === undefined ? 'normal' : raw.priority
  if (!isPriority(priority)) {
    return { ok: false, message: 'Choose a priority: normal, medium, high or urgent.' }
  }
  const description = optionalText(raw.description, MAX_DESCRIPTION_LENGTH)
  if (description === 'too_long') {
    return { ok: false, message: `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.` }
  }
  const dueString = optionalText(raw.dueString, MAX_DUE_STRING_LENGTH)
  if (dueString === 'too_long') {
    return { ok: false, message: `Keep the due date under ${MAX_DUE_STRING_LENGTH} characters.` }
  }
  return { ok: true, data: { title, description, priority, dueString } }
}

export interface ProposedBreakdown {
  projectTitle: string
  tasks: Array<TaskEditInput>
}

// The `propose_task_breakdown` tool arguments: a project title plus a
// flat list of tasks (CONTEXT.md's Task Breakdown entry — no nesting).
// An invalid call is rejected wholesale so the turn can surface a
// retryable error rather than persisting a half-valid breakdown.
export function parseProposedBreakdown(input: unknown): ParsedCredentials<ProposedBreakdown> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, message: 'The breakdown arrived without a project title and tasks.' }
  }
  const raw = input as Record<string, unknown>
  const projectTitle = typeof raw.project_title === 'string' ? raw.project_title.trim() : ''
  if (projectTitle === '') {
    return { ok: false, message: 'The breakdown arrived without a project title.' }
  }
  if (projectTitle.length > MAX_TITLE_LENGTH) {
    return { ok: false, message: `Keep the project title under ${MAX_TITLE_LENGTH} characters.` }
  }
  if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
    return { ok: false, message: 'The breakdown arrived without any tasks.' }
  }
  if (raw.tasks.length > MAX_TASKS) {
    return { ok: false, message: `The breakdown has too many tasks — keep it under ${MAX_TASKS}.` }
  }
  const tasks: Array<TaskEditInput> = []
  for (const task of raw.tasks) {
    if (typeof task !== 'object' || task === null) {
      return { ok: false, message: 'The breakdown arrived with a malformed task.' }
    }
    // The tool schema spells the field `due_string`; the rest of the app
    // uses camelCase — normalize here so both ends share one parser.
    const { due_string: dueString, ...rest } = task as Record<string, unknown>
    const parsed = parseTaskEdit(dueString === undefined ? task : { ...rest, dueString })
    if (!parsed.ok) {
      return parsed
    }
    tasks.push(parsed.data)
  }
  return { ok: true, data: { projectTitle, tasks } }
}
