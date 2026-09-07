// The Interview's multi-turn loop (issues #24 and #25). One function,
// one turn: persist the user's message, call OpenRouter with the single
// system prompt spanning the whole Interview, honor `mark_checkpoint`
// and `propose_task_breakdown` if the model fires them, and persist the
// assistant's reply.
//
// The tool swap is the mechanical guard settled in docs/plan.md §7:
// mark_checkpoint is offered until it fires, then — and only then —
// propose_task_breakdown is offered instead; once the breakdown has
// fired, no tools are offered at all. Phase is never stored — the
// orchestrator just persists which tool calls happened, and derivePhase
// reads the transcript (CONTEXT.md's Phase entry).
//
// All side effects arrive as injected ports — the db wiring lives in
// interview-actions.ts, and the tests drive this entirely in-memory.
import type { Phase } from '../phase.ts'
import { derivePhase } from '../phase.ts'
import type { TaskEditInput } from '../task-input.ts'
import { parseProposedBreakdown } from '../task-input.ts'
import {
  INTERVIEW_SYSTEM_PROMPT,
  MARK_CHECKPOINT_TOOL,
  PROPOSE_TASK_BREAKDOWN_TOOL,
} from './interview-prompt.ts'
import type { OpenRouterClient, OpenRouterRequestMessage } from './openrouter.ts'

// A normalized row of the `messages` table (schema/app.ts) — never a
// JSONB blob of the whole transcript.
export interface StoredMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  toolName: string | null
  toolArgs: Record<string, unknown> | null
}

// One proposed task, normalized exactly as it lands in the `tasks`
// table: missing priority defaults to "normal", missing optional fields
// to null, position encoding the model's ordering.
export interface ProposedTask extends TaskEditInput {
  position: number
}

export interface InterviewPorts {
  llm: OpenRouterClient
  appendMessage(sessionId: string, message: StoredMessage): Promise<void>
  getTranscript(sessionId: string): Promise<StoredMessage[]>
  updateSessionSummary(sessionId: string, projectSummary: string): Promise<void>
  updateSessionTitle(sessionId: string, projectTitle: string): Promise<void>
  saveProposedTasks(sessionId: string, tasks: ReadonlyArray<ProposedTask>): Promise<void>
}

export interface TurnResult {
  assistantReply: string
  phase: Phase
  projectSummary: string | null
  projectTitle: string | null
  firedCheckpoint: boolean
  firedBreakdown: boolean
}

// The model may legitimately answer with mark_checkpoint, then
// propose_task_breakdown, then a text reply (two extra hops); anything
// beyond this is a runaway loop, not a conversation.
const MAX_MODEL_HOPS = 3

// The two model-initiated tool calls, whose persisted rows round-trip
// into API requests as assistant tool_calls plus a synthetic result.
const MODEL_TOOL_NAMES = new Set(['mark_checkpoint', 'propose_task_breakdown'])

function toApiMessages(transcript: StoredMessage[]): OpenRouterRequestMessage[] {
  const apiMessages: OpenRouterRequestMessage[] = [{ role: 'system', content: INTERVIEW_SYSTEM_PROMPT }]
  let nextToolCallId = 1
  for (const row of transcript) {
    if (row.role === 'user') {
      apiMessages.push({ role: 'user', content: row.content ?? '' })
      continue
    }
    if (row.toolName !== null && MODEL_TOOL_NAMES.has(row.toolName)) {
      const id = `call_${row.toolName}_${nextToolCallId++}`
      apiMessages.push({
        role: 'assistant',
        content: row.content,
        tool_calls: [
          {
            id,
            type: 'function',
            function: { name: row.toolName, arguments: JSON.stringify(row.toolArgs ?? {}) },
          },
        ],
      })
      // The synthetic tool result the API requires after a tool call;
      // rebuilt at request time rather than persisted as a turn.
      apiMessages.push({ role: 'tool', tool_call_id: id, content: 'ok' })
      continue
    }
    apiMessages.push({ role: 'assistant', content: row.content })
  }
  return apiMessages
}

export async function runInterviewTurn(
  ports: InterviewPorts,
  sessionId: string,
  userMessage: string,
): Promise<TurnResult> {
  await ports.appendMessage(sessionId, {
    role: 'user',
    content: userMessage,
    toolName: null,
    toolArgs: null,
  })

  let firedCheckpoint = false
  let firedBreakdown = false
  for (let hop = 0; hop < MAX_MODEL_HOPS; hop++) {
    const transcript = await ports.getTranscript(sessionId)
    const firedTools = new Set(
      transcript.flatMap((row) => (row.toolName === null ? [] : [row.toolName])),
    )
    const checkpointFired = firedTools.has('mark_checkpoint')
    const breakdownFired = firedTools.has('propose_task_breakdown')
    // The mechanical guard: swap in the breakdown tool only after the
    // checkpoint has fired, and offer nothing once it has fired too.
    const tools = breakdownFired
      ? []
      : checkpointFired
        ? [PROPOSE_TASK_BREAKDOWN_TOOL]
        : [MARK_CHECKPOINT_TOOL]
    const result = await ports.llm.complete(toApiMessages(transcript), tools)

    const checkpointCall = result.toolCalls.find((call) => call.function.name === 'mark_checkpoint')
    if (checkpointCall && !checkpointFired) {
      let parsed: { project_summary?: unknown }
      try {
        parsed = JSON.parse(checkpointCall.function.arguments) as { project_summary?: unknown }
      } catch {
        throw new Error('mark_checkpoint arrived with unparseable arguments')
      }
      if (typeof parsed.project_summary !== 'string' || parsed.project_summary.trim() === '') {
        throw new Error('mark_checkpoint arrived without a project_summary string')
      }
      const projectSummary = parsed.project_summary.trim()
      await ports.appendMessage(sessionId, {
        role: 'assistant',
        content: result.content,
        toolName: 'mark_checkpoint',
        toolArgs: { project_summary: projectSummary },
      })
      await ports.updateSessionSummary(sessionId, projectSummary)
      firedCheckpoint = true
      continue
    }

    const breakdownCall = result.toolCalls.find(
      (call) => call.function.name === 'propose_task_breakdown',
    )
    if (breakdownCall && !breakdownFired) {
      let parsedArgs: unknown
      try {
        parsedArgs = JSON.parse(breakdownCall.function.arguments)
      } catch {
        throw new Error('propose_task_breakdown arrived with unparseable arguments')
      }
      const parsed = parseProposedBreakdown(parsedArgs)
      if (!parsed.ok) {
        throw new Error(`propose_task_breakdown arrived invalid: ${parsed.message}`)
      }
      const { projectTitle, tasks } = parsed.data
      const proposedTasks: Array<ProposedTask> = tasks.map((task, position) => ({
        ...task,
        position,
      }))
      await ports.appendMessage(sessionId, {
        role: 'assistant',
        content: result.content,
        toolName: 'propose_task_breakdown',
        toolArgs: { project_title: projectTitle, tasks },
      })
      await ports.updateSessionTitle(sessionId, projectTitle)
      await ports.saveProposedTasks(sessionId, proposedTasks)
      firedBreakdown = true
      continue
    }

    if (typeof result.content === 'string' && result.content.trim() !== '') {
      await ports.appendMessage(sessionId, {
        role: 'assistant',
        content: result.content,
        toolName: null,
        toolArgs: null,
      })
      const finalTranscript = await ports.getTranscript(sessionId)
      const summaryRow = finalTranscript.find((row) => row.toolName === 'mark_checkpoint')
      const breakdownRow = finalTranscript.find((row) => row.toolName === 'propose_task_breakdown')
      const projectSummary =
        typeof summaryRow?.toolArgs?.project_summary === 'string'
          ? summaryRow.toolArgs.project_summary
          : null
      const projectTitle =
        typeof breakdownRow?.toolArgs?.project_title === 'string'
          ? breakdownRow.toolArgs.project_title
          : null
      return {
        assistantReply: result.content,
        phase: derivePhase(finalTranscript, null),
        projectSummary,
        projectTitle,
        firedCheckpoint,
        firedBreakdown,
      }
    }

    throw new Error(
      'The model responded with neither content nor a usable tool call — retry the turn.',
    )
  }

  throw new Error(
    'Too many consecutive tool-call responses from the model without a reply — retry the turn.',
  )
}
