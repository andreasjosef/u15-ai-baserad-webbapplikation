// Phase is never stored as its own column — it is always derived from
// which tool-call rows have appeared so far in the Session's transcript
// (CONTEXT.md's Phase entry), with `todoist_project_id` doubling as the
// Completed-phase signal (schema/app.ts).
export type Phase = 'Defining' | 'Drilling' | 'Proposed' | 'Completed'

export interface TranscriptToolRow {
  toolName: string | null
}

export function derivePhase(
  transcript: ReadonlyArray<TranscriptToolRow>,
  todoistProjectId: string | null,
): Phase {
  if (todoistProjectId !== null) {
    return 'Completed'
  }
  const firedTools = new Set(
    transcript.flatMap((row) => (row.toolName === null ? [] : [row.toolName])),
  )
  if (firedTools.has('propose_task_breakdown')) {
    return 'Proposed'
  }
  if (firedTools.has('mark_checkpoint')) {
    return 'Drilling'
  }
  return 'Defining'
}
