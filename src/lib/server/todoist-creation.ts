// The create_todoist_tasks orchestrator (issue #26) — the direct backend
// action fired when the user confirms the reviewed Task Breakdown. Never
// a model tool call: it is not in the model's tool list anywhere
// (docs/plan.md §7), the confirm button is the only trigger.
//
// Shape of the run: create the dedicated Todoist project named from
// project_title (never the user's Inbox, never an existing project),
// then create each task flat inside it — no nesting, no labels. Any
// failure (a task creation, or persisting the result) deletes the
// project — rollback — so no partial project is ever left behind, and
// the user sees one clean, retryable error. Retrying is confirming
// again; there is no separate retry state.
//
// Side effects arrive as injected ports — the real wiring (Todoist REST
// client, Drizzle) lives in todoist-creation-actions.ts, and the tests
// drive this entirely in-memory.
import type { TaskPriority } from '../task-input.ts'

// One failure copy for every failure path (plan.md §10 — no silent
// failures, one retryable message).
export const TODOIST_CREATION_FAILURE =
  'Something went wrong creating your tasks in Todoist. Try again.'

// One row of the persisted breakdown, as the orchestrator consumes it —
// the friendly priority enum, mapped to Todoist's integers by the
// client at the API boundary.
export interface BreakdownTask {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  dueString: string | null
}

export interface TodoistCreationPorts {
  createProject(projectTitle: string): Promise<string>
  createTask(
    projectId: string,
    task: {
      content: string
      description: string | null
      priority: TaskPriority
      dueString: string | null
    },
  ): Promise<string>
  deleteProject(projectId: string): Promise<void>
  // The Completed signal (interview_sessions.todoist_project_id) plus
  // each task's todoist_task_id, written only after every task exists.
  markSessionCompleted(
    sessionId: string,
    todoistProjectId: string,
    tasks: ReadonlyArray<{ taskId: string; todoistTaskId: string }>,
  ): Promise<void>
}

export type TodoistCreationResult =
  | { ok: true; todoistProjectId: string }
  | { ok: false; message: string }

export async function createTodoistTasks(
  ports: TodoistCreationPorts,
  sessionId: string,
  projectTitle: string,
  tasks: ReadonlyArray<BreakdownTask>,
): Promise<TodoistCreationResult> {
  if (tasks.length === 0) {
    return { ok: false, message: 'The breakdown has no tasks to create.' }
  }

  let projectId: string | null = null
  try {
    projectId = await ports.createProject(projectTitle)
    const createdTasks: Array<{ taskId: string; todoistTaskId: string }> = []
    for (const task of tasks) {
      const todoistTaskId = await ports.createTask(projectId, {
        content: task.title,
        description: task.description,
        priority: task.priority,
        dueString: task.dueString,
      })
      createdTasks.push({ taskId: task.id, todoistTaskId })
    }
    // Persist the Completed signal last: if this write fails, the whole
    // run still rolls back so a retry starts clean rather than leaving
    // a real Todoist project the app believes never happened.
    await ports.markSessionCompleted(sessionId, projectId, createdTasks)
    return { ok: true, todoistProjectId: projectId }
  } catch {
    // Rollback is best-effort — if even the delete fails, the user still
    // gets the one clean retryable error rather than a thrown raw error
    // (no retry state exists to park the orphan in). Confirming again
    // then builds a fresh project from the reviewed breakdown.
    if (projectId !== null) {
      await ports.deleteProject(projectId).catch(() => {})
    }
    return { ok: false, message: TODOIST_CREATION_FAILURE }
  }
}
