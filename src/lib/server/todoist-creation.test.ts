// Tests for the create_todoist_tasks orchestrator (issue #26) — the
// direct backend action behind the review table's confirm button, never
// a model tool call. Ports are in-memory so the orchestration — project
// first, then tasks flat inside it, rollback of the whole project on any
// failure — is asserted without a db or network (the root spec's
// declared seam: external behavior, not private helpers).
import { describe, expect, it } from 'vitest'

import type { TaskPriority } from '../task-input.ts'
import { createTodoistTasks, TODOIST_CREATION_FAILURE, type TodoistCreationPorts } from './todoist-creation.ts'

interface PortCalls {
  projects: Array<{ name: string }>
  tasks: Array<{ projectId: string; content: string; priority: TaskPriority }>
  deletedProjects: Array<string>
  completions: Array<{
    sessionId: string
    todoistProjectId: string
    tasks: Array<{ taskId: string; todoistTaskId: string }>
  }>
}

function makePorts(overrides?: Partial<TodoistCreationPorts>): { calls: PortCalls; ports: TodoistCreationPorts } {
  const calls: PortCalls = { projects: [], tasks: [], deletedProjects: [], completions: [] }
  let nextId = 1
  const ports: TodoistCreationPorts = {
    createProject: async (title) => {
      calls.projects.push({ name: title })
      return `proj-${nextId++}`
    },
    createTask: async (projectId, task) => {
      calls.tasks.push({ projectId, content: task.content, priority: task.priority })
      return `task-${nextId++}`
    },
    deleteProject: async (projectId) => {
      calls.deletedProjects.push(projectId)
    },
    markSessionCompleted: async (sessionId, todoistProjectId, tasks) => {
      calls.completions.push({ sessionId, todoistProjectId, tasks: [...tasks] })
    },
    ...overrides,
  }
  return { calls, ports }
}

const breakdownTasks = [
  { id: 't1', title: 'Clear out old boxes', description: 'The green bags', priority: 'high' as TaskPriority, dueString: 'this weekend' },
  { id: 't2', title: 'Take donations to the tip', description: null, priority: 'normal' as TaskPriority, dueString: null },
]

describe('createTodoistTasks', () => {
  it('creates the dedicated project, then each task flat inside it in order', async () => {
    const { calls, ports } = makePorts()

    const result = await createTodoistTasks(ports, 'session-1', 'Garage cleanup', breakdownTasks)

    expect(result).toEqual({ ok: true, todoistProjectId: 'proj-1' })
    expect(calls.projects).toEqual([{ name: 'Garage cleanup' }])
    expect(calls.tasks).toEqual([
      { projectId: 'proj-1', content: 'Clear out old boxes', priority: 'high' },
      { projectId: 'proj-1', content: 'Take donations to the tip', priority: 'normal' },
    ])
    // Success persists the Completed signal plus each task's Todoist id.
    expect(calls.completions).toEqual([
      {
        sessionId: 'session-1',
        todoistProjectId: 'proj-1',
        tasks: [
          { taskId: 't1', todoistTaskId: 'task-2' },
          { taskId: 't2', todoistTaskId: 'task-3' },
        ],
      },
    ])
  })

  it('creates nothing when the breakdown has no tasks', async () => {
    const { calls, ports } = makePorts()

    const result = await createTodoistTasks(ports, 'session-1', 'Garage cleanup', [])

    expect(result).toEqual({ ok: false, message: 'The breakdown has no tasks to create.' })
    expect(calls.projects).toEqual([])
    expect(calls.completions).toEqual([])
  })

  it('rolls the whole project back when a task creation fails partway', async () => {
    const { calls, ports } = makePorts({
      createTask: async (_projectId, task) => {
        if (task.content === 'Take donations to the tip') {
          throw new Error('Todoist 500')
        }
        return 'task-ok'
      },
    })

    const result = await createTodoistTasks(ports, 'session-1', 'Garage cleanup', breakdownTasks)

    expect(result).toEqual({ ok: false, message: TODOIST_CREATION_FAILURE })
    expect(calls.deletedProjects).toEqual(['proj-1'])
    // No Completed signal, no task ids — the retry starts from a clean slate.
    expect(calls.completions).toEqual([])
  })

  it('rolls the project back when persisting the result fails', async () => {
    const { calls, ports } = makePorts({
      markSessionCompleted: async () => {
        throw new Error('db down')
      },
    })

    const result = await createTodoistTasks(ports, 'session-1', 'Garage cleanup', breakdownTasks)

    expect(result).toEqual({ ok: false, message: TODOIST_CREATION_FAILURE })
    expect(calls.deletedProjects).toEqual(['proj-1'])
  })

  it('still reports one clean failure when the rollback itself throws', async () => {
    const { ports } = makePorts({
      createTask: async () => {
        throw new Error('Todoist 500')
      },
      deleteProject: async () => {
        throw new Error('Todoist down again')
      },
    })

    const result = await createTodoistTasks(ports, 'session-1', 'Garage cleanup', breakdownTasks)

    expect(result).toEqual({ ok: false, message: TODOIST_CREATION_FAILURE })
  })
})
