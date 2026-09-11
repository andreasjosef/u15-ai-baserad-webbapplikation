// Phase is never stored as its own column — it is always derived from
// which tool-call rows have appeared so far in the Session's transcript
// (CONTEXT.md's Phase entry), with `todoist_project_id` doubling as the
// Completed-phase signal (schema/app.ts).
import { describe, expect, it } from 'vitest'

import { derivePhase, type Phase } from './phase.ts'

function transcript(...toolNames: Array<string | null>) {
  return toolNames.map((toolName) => ({ toolName }))
}

describe('derivePhase', () => {
  it('is Defining while no mark_checkpoint message exists', () => {
    expect(derivePhase(transcript(null, null), null)).toBe<Phase>('Defining')
  })

  it('is Drilling once a mark_checkpoint message exists', () => {
    expect(derivePhase(transcript(null, 'mark_checkpoint'), null)).toBe('Drilling')
  })

  it('is Proposed once a propose_task_breakdown message exists', () => {
    expect(
      derivePhase(transcript('mark_checkpoint', null, 'propose_task_breakdown'), null),
    ).toBe('Proposed')
  })

  it('is Completed once todoist_project_id is set, regardless of the transcript', () => {
    expect(
      derivePhase(transcript('mark_checkpoint', 'propose_task_breakdown'), 'proj-123'),
    ).toBe('Completed')
  })

  it('ignores tool names it does not know', () => {
    expect(derivePhase(transcript('create_todoist_tasks'), null)).toBe('Defining')
  })

  it('keeps later phases on an empty transcript when only the project id is set', () => {
    expect(derivePhase([], 'proj-123')).toBe('Completed')
  })
})
