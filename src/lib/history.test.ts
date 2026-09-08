// Tests for the history list-row assembly (issue #27). Phase must come
// from the same derivation rules used everywhere else (CONTEXT.md's
// Phase entry — via derivePhase), the task count from the tasks-table
// row count, and the list must be ordered most-recent-first.
import { describe, expect, it } from 'vitest'

import { buildHistoryRows, type RawSessionRow } from './history.ts'

const base: RawSessionRow = {
  sessionId: 's1',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  projectSummary: 'Sort out the garage',
  projectTitle: null,
  todoistProjectId: null,
  toolNames: [],
  taskCount: 0,
}

describe('buildHistoryRows', () => {
  it('derives each Phase from the tool calls seen in the transcript', () => {
    const rows = buildHistoryRows([
      { ...base, sessionId: 'defining', toolNames: [] },
      { ...base, sessionId: 'drilling', toolNames: ['mark_checkpoint'] },
      { ...base, sessionId: 'proposed', toolNames: ['mark_checkpoint', 'propose_task_breakdown'] },
      {
        ...base,
        sessionId: 'completed',
        toolNames: ['mark_checkpoint', 'propose_task_breakdown'],
        todoistProjectId: 'proj-1',
      },
    ])
    expect(rows.map((row) => row.phase)).toEqual(['Defining', 'Drilling', 'Proposed', 'Completed'])
  })

  it('counts Completed from todoist_project_id even when a tool row is missing', () => {
    const rows = buildHistoryRows([{ ...base, toolNames: [], todoistProjectId: 'proj-1' }])
    expect(rows[0]?.phase).toBe('Completed')
  })

  it('carries the task count from the tasks-table row count', () => {
    const rows = buildHistoryRows([{ ...base, taskCount: 5 }])
    expect(rows[0]?.taskCount).toBe(5)
  })

  it('orders sessions most-recent-first', () => {
    const rows = buildHistoryRows([
      { ...base, sessionId: 'older', createdAt: new Date('2026-09-01T10:00:00Z') },
      { ...base, sessionId: 'newer', createdAt: new Date('2026-09-03T10:00:00Z') },
      { ...base, sessionId: 'oldest', createdAt: new Date('2026-08-30T10:00:00Z') },
    ])
    expect(rows.map((row) => row.sessionId)).toEqual(['newer', 'older', 'oldest'])
  })
})
