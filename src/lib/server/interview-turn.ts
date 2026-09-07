// The Interview's multi-turn loop (issue #24). One function, one turn:
// persist the user's message, call OpenRouter with the single system
// prompt spanning the whole Interview, honor `mark_checkpoint` if the
// model fires it (persist the tool row, cache the summary, re-prompt
// without the tool), and persist the assistant's reply.
//
// All side effects arrive as injected ports — the db wiring lives in
// interview-actions.ts, and the tests drive this entirely in-memory.
import type { Phase } from '../phase.ts'
import { derivePhase } from '../phase.ts'
import { INTERVIEW_SYSTEM_PROMPT, MARK_CHECKPOINT_TOOL } from './interview-prompt.ts'
import type { OpenRouterClient, OpenRouterRequestMessage } from './openrouter.ts'

// A normalized row of the `messages` table (schema/app.ts) — never a
// JSONB blob of the whole transcript.
export interface StoredMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  toolName: string | null
  toolArgs: Record<string, unknown> | null
}

export interface InterviewPorts {
  llm: OpenRouterClient
  appendMessage(sessionId: string, message: StoredMessage): Promise<void>
  getTranscript(sessionId: string): Promise<StoredMessage[]>
  updateSessionSummary(sessionId: string, projectSummary: string): Promise<void>
}

export interface TurnResult {
  assistantReply: string
  phase: Phase
  projectSummary: string | null
  firedCheckpoint: boolean
}

// The model may legitimately answer with mark_checkpoint then a text
// reply (one extra hop); anything beyond this is a runaway loop, not a
// conversation.
const MAX_MODEL_HOPS = 3

function toApiMessages(transcript: StoredMessage[]): OpenRouterRequestMessage[] {
  const apiMessages: OpenRouterRequestMessage[] = [{ role: 'system', content: INTERVIEW_SYSTEM_PROMPT }]
  let nextToolCallId = 1
  for (const row of transcript) {
    if (row.role === 'user') {
      apiMessages.push({ role: 'user', content: row.content ?? '' })
      continue
    }
    if (row.toolName === 'mark_checkpoint') {
      const id = `call_checkpoint_${nextToolCallId++}`
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
  for (let hop = 0; hop < MAX_MODEL_HOPS; hop++) {
    const transcript = await ports.getTranscript(sessionId)
    const checkpointFired = transcript.some((row) => row.toolName === 'mark_checkpoint')
    const result = await ports.llm.complete(
      toApiMessages(transcript),
      checkpointFired ? [] : [MARK_CHECKPOINT_TOOL],
    )

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

    if (typeof result.content === 'string' && result.content.trim() !== '') {
      await ports.appendMessage(sessionId, {
        role: 'assistant',
        content: result.content,
        toolName: null,
        toolArgs: null,
      })
      const finalTranscript = await ports.getTranscript(sessionId)
      const summaryRow = finalTranscript.find((row) => row.toolName === 'mark_checkpoint')
      const projectSummary =
        typeof summaryRow?.toolArgs?.project_summary === 'string'
          ? summaryRow.toolArgs.project_summary
          : null
      return {
        assistantReply: result.content,
        phase: derivePhase(finalTranscript, null),
        projectSummary,
        firedCheckpoint,
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
