// History list-row assembly (issue #27). Pure: the server actions hand
// over raw rows (each session's tool-call names and its tasks-table row
// count) and this module derives the view shape — Phase via the same
// shared derivation used everywhere else (CONTEXT.md's Phase entry), a
// row count as the task count, most-recent-first ordering.
import type { Phase } from './phase.ts'
import { derivePhase } from './phase.ts'

// What the server action selects for each of the user's Sessions: the
// session row itself plus its tool-call names (from the transcript) and
// task count (from the tasks table).
export interface RawSessionRow {
  sessionId: string
  createdAt: Date
  projectSummary: string | null
  projectTitle: string | null
  todoistProjectId: string | null
  toolNames: Array<string>
  taskCount: number
}

// The history list row, shared by the server actions (which build it),
// the route (which fetches it) and the component (which renders it).
export interface HistorySessionRow {
  sessionId: string
  createdAt: Date
  phase: Phase
  projectSummary: string | null
  projectTitle: string | null
  taskCount: number
}

export function buildHistoryRows(sessions: ReadonlyArray<RawSessionRow>): Array<HistorySessionRow> {
  return [...sessions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((session) => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      phase: derivePhase(
        session.toolNames.map((toolName) => ({ toolName })),
        session.todoistProjectId,
      ),
      projectSummary: session.projectSummary,
      projectTitle: session.projectTitle,
      taskCount: session.taskCount,
    }))
}
