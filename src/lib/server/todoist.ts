// Thin Todoist REST API v1 client (issue #26). fetch is injected so the
// request/response mapping is testable without a network, mirroring
// openrouter.ts. The user's own decrypted personal API token is passed
// in per client and stays server-side — this module is only ever
// imported from server functions.
//
// The friendly priority enum maps to Todoist's inverted 1-4 integer
// scale here, at the API boundary (plan.md §5): API 1 is the UI's
// least-urgent P4, API 4 the most-urgent P1. Task `title` maps to
// Todoist's `content`; due dates go through `due_string` (NL,
// Todoist-parsed) only. No `labels` for MVP (dropped, not deferred).
import type { TaskPriority } from '../task-input.ts'

type FetchImpl = typeof fetch

export const TODOIST_API_BASE = 'https://api.todoist.com/api/v1'

export function toTodoistPriority(priority: unknown): number {
  switch (priority) {
    case 'medium':
      return 2
    case 'high':
      return 3
    case 'urgent':
      return 4
    default:
      // "normal" — and defensively, anything the app never wrote.
      return 1
  }
}

export interface TodoistTaskInput {
  content: string
  description?: string | null
  priority: TaskPriority
  dueString?: string | null
}

export interface TodoistClient {
  createProject(name: string): Promise<string>
  createTask(projectId: string, task: TodoistTaskInput): Promise<string>
  deleteProject(projectId: string): Promise<void>
}

async function readId(response: Response): Promise<string> {
  const body = (await response.json()) as { id?: unknown }
  if (typeof body.id !== 'string') {
    throw new Error('Todoist response contained no id')
  }
  return body.id
}

export function createTodoistClient(options: {
  apiToken: string
  fetchImpl?: FetchImpl
}): TodoistClient {
  const doFetch = options.fetchImpl ?? fetch

  async function request(url: string, init: RequestInit): Promise<Response> {
    const response = await doFetch(url, init)
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      throw new Error(
        `Todoist request failed with status ${response.status}${bodyText ? `: ${bodyText.slice(0, 300)}` : ''}`,
      )
    }
    return response
  }

  return {
    async createProject(name) {
      const response = await request(`${TODOIST_API_BASE}/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })
      return readId(response)
    },

    async createTask(projectId, task) {
      const response = await request(`${TODOIST_API_BASE}/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          content: task.content,
          // Only the fields the task actually carries — a missing
          // optional field is omitted rather than sent empty.
          ...(task.description ? { description: task.description } : {}),
          priority: toTodoistPriority(task.priority),
          ...(task.dueString ? { due_string: task.dueString } : {}),
        }),
      })
      return readId(response)
    },

    async deleteProject(projectId) {
      await request(`${TODOIST_API_BASE}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${options.apiToken}` },
      })
    },
  }
}
