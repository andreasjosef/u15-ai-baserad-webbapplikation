// What a priority means, visually and as a section order (issue #109) —
// extracted from the Task Breakdown review so the Completed-screen
// receipt (next ticket) reuses the same mapping instead of redefining
// it. Plain data + one pure function, no React. The color language is
// the prototype's locked-in call (issue #107's Direction C): gray for
// Normal, the primary purple for Medium, amber for High, the
// destructive red for Urgent.
import type { TaskPriority } from '../lib/task-input.ts'
import { TASK_PRIORITIES } from '../lib/task-input.ts'

// The fixed section order — Urgent first, the friendly enum's storage
// order (Normal first) reversed.
export const PRIORITY_GROUPS: ReadonlyArray<TaskPriority> = [...TASK_PRIORITIES].reverse()

export interface Prioritised {
  priority: TaskPriority
}

// One entry per priority: the label shown in section headings (and the
// priority <option> text) plus the dot/text classes carrying the color.
export const PRIORITY_META: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  normal: { label: 'Normal', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
  medium: { label: 'Medium', dot: 'bg-primary', text: 'text-primary' },
  high: { label: 'High', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  urgent: { label: 'Urgent', dot: 'bg-destructive', text: 'text-destructive' },
}

// The grouped view of a flat task list: one entry per non-empty
// priority, in the fixed section order, each holding its tasks in the
// order given (getTaskBreakdown's `position`-then-`createdAt` order).
export function groupTasksByPriority<T extends Prioritised>(
  tasks: ReadonlyArray<T>,
): Array<{ priority: TaskPriority; tasks: Array<T> }> {
  const groups: Array<{ priority: TaskPriority; tasks: Array<T> }> = []
  for (const priority of PRIORITY_GROUPS) {
    const matching = tasks.filter((task) => task.priority === priority)
    if (matching.length > 0) {
      groups.push({ priority, tasks: matching })
    }
  }
  return groups
}
