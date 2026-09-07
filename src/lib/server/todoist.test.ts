// Tests for the Todoist REST API v1 client (issue #26). fetch is
// injected, so the request/response mapping — bearer auth, the field
// names Todoist expects, and the friendly-enum → inverted-integer
// priority mapping — is asserted without a network.
import { describe, expect, it, vi } from 'vitest'

import { createTodoistClient, TODOIST_API_BASE, toTodoistPriority } from './todoist.ts'

function fetchJson(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('toTodoistPriority', () => {
  // Todoist's scale is inverted relative to the friendly enum: API 1 is
  // the UI's least-urgent P4, API 4 the most-urgent P1 (plan.md §5).
  it('maps the friendly enum onto Todoist\'s 1-4 integer scale', () => {
    expect(toTodoistPriority('normal')).toBe(1)
    expect(toTodoistPriority('medium')).toBe(2)
    expect(toTodoistPriority('high')).toBe(3)
    expect(toTodoistPriority('urgent')).toBe(4)
  })

  it('coerces a value the app never wrote to normal (1)', () => {
    expect(toTodoistPriority('bogus')).toBe(1)
    expect(toTodoistPriority(undefined)).toBe(1)
  })
})

describe('createTodoistClient', () => {
  it('creates a project from the breakdown\'s project_title', async () => {
    const fetchImpl = fetchJson({ id: 'proj-1', name: 'Garage cleanup' })
    const client = createTodoistClient({ apiToken: 'token-123', fetchImpl })

    const id = await client.createProject('Garage cleanup')

    expect(id).toBe('proj-1')
    expect(fetchImpl).toHaveBeenCalledWith(`${TODOIST_API_BASE}/projects`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Garage cleanup' }),
    })
  })

  it('creates a task flat inside the project, mapping title→content and due_string', async () => {
    const fetchImpl = fetchJson({ id: 'task-1' })
    const client = createTodoistClient({ apiToken: 'token-123', fetchImpl })

    const id = await client.createTask('proj-1', {
      content: 'Clear out old boxes',
      description: 'The green bags',
      priority: 'high',
      dueString: 'this weekend',
    })

    expect(id).toBe('task-1')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${TODOIST_API_BASE}/tasks`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      project_id: 'proj-1',
      content: 'Clear out old boxes',
      description: 'The green bags',
      priority: 3,
      due_string: 'this weekend',
    })
  })

  it('omits a task\'s absent description and due date entirely', async () => {
    const fetchImpl = fetchJson({ id: 'task-1' })
    const client = createTodoistClient({ apiToken: 'token-123', fetchImpl })

    await client.createTask('proj-1', { content: 'Sweep the floor', priority: 'normal' })

    expect(JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({
      project_id: 'proj-1',
      content: 'Sweep the floor',
      priority: 1,
    })
  })

  it('deletes a project by id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = createTodoistClient({ apiToken: 'token-123', fetchImpl })

    await client.deleteProject('proj-1')

    expect(fetchImpl).toHaveBeenCalledWith(`${TODOIST_API_BASE}/projects/proj-1`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-123' },
    })
  })

  it('throws on a non-ok response so the caller can roll back', async () => {
    const fetchImpl = fetchJson({ error: 'nope' }, 401)
    const client = createTodoistClient({ apiToken: 'bad-token', fetchImpl })

    await expect(client.createProject('Garage cleanup')).rejects.toThrow(/status 401/)
  })
})
