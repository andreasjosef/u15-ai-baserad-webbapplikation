// Tests for the Interview turn orchestrator. All side effects (db,
// OpenRouter) arrive as injected ports, so the multi-turn loop, tool
// persistence, and Checkpoint transition are exercised in-memory.
import { describe, expect, it, vi } from 'vitest'

import { INTERVIEW_SYSTEM_PROMPT, MARK_CHECKPOINT_TOOL } from './interview-prompt.ts'
import { runInterviewTurn, type InterviewPorts, type StoredMessage } from './interview-turn.ts'

interface FakeState {
  messages: Array<StoredMessage & { sessionId: string }>
  projectSummary: string | null
}

function makePorts(
  state: FakeState,
  llm: InterviewPorts['llm'],
): InterviewPorts {
  return {
    llm,
    async appendMessage(sessionId, message) {
      state.messages.push({ sessionId, ...message })
    },
    async getTranscript(sessionId) {
      return state.messages.filter((m) => m.sessionId === sessionId)
    },
    async updateSessionSummary(_sessionId, projectSummary) {
      state.projectSummary = projectSummary
    },
  }
}

function textLlm(replies: Array<{ content: string | null; toolCalls?: never[] }>) {
  const complete = vi.fn()
  replies.forEach((reply) =>
    complete.mockResolvedValueOnce({ toolCalls: [], ...reply }),
  )
  return { complete }
}

describe('runInterviewTurn', () => {
  it('persists the user message, returns the assistant question, and records a plain Defining turn', async () => {
    const state: FakeState = { messages: [], projectSummary: null }
    const ports = makePorts(
      state,
      textLlm([{ content: 'What does "sorted out" actually mean to you?' }]),
    )

    const result = await runInterviewTurn(ports, 's1', 'I should sort out the garage')

    expect(result).toEqual({
      assistantReply: 'What does "sorted out" actually mean to you?',
      phase: 'Defining',
      projectSummary: null,
      firedCheckpoint: false,
    })
    expect(state.messages).toEqual([
      { sessionId: 's1', role: 'user', content: 'I should sort out the garage', toolName: null, toolArgs: null },
      { sessionId: 's1', role: 'assistant', content: 'What does "sorted out" actually mean to you?', toolName: null, toolArgs: null },
    ])
  })

  it('sends the system prompt, the full transcript, and mark_checkpoint (pre-Checkpoint) to the model', async () => {
    const state: FakeState = {
      messages: [
        { sessionId: 's1', role: 'user', content: 'I should sort out the garage', toolName: null, toolArgs: null },
        { sessionId: 's1', role: 'assistant', content: 'What does sorted out mean?', toolName: null, toolArgs: null },
      ],
      projectSummary: null,
    }
    const complete = vi.fn().mockResolvedValue({ content: 'next question', toolCalls: [] })
    const ports = makePorts(state, { complete })

    await runInterviewTurn(ports, 's1', 'Everything out, floor swept')

    const [messages, tools] = complete.mock.calls[0] as unknown as [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ]
    expect(messages[0]).toEqual({ role: 'system', content: INTERVIEW_SYSTEM_PROMPT })
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(tools).toEqual([MARK_CHECKPOINT_TOOL])
  })

  it('handles mark_checkpoint: persists the tool row, caches the summary, re-prompts without the tool, and reports Drilling', async () => {
    const state: FakeState = { messages: [], projectSummary: null }
    const complete = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'Sounds like we are converging.',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'mark_checkpoint', arguments: '{"project_summary":"Sort out the garage"}' },
          },
        ],
      })
      .mockResolvedValueOnce({ content: 'Now, what has to happen first?', toolCalls: [] })
    const ports = makePorts(state, { complete })

    const result = await runInterviewTurn(ports, 's1', 'I should sort out the garage')

    expect(result.firedCheckpoint).toBe(true)
    expect(result.phase).toBe('Drilling')
    expect(result.projectSummary).toBe('Sort out the garage')
    expect(result.assistantReply).toBe('Now, what has to happen first?')
    expect(state.projectSummary).toBe('Sort out the garage')
    expect(state.messages).toEqual([
      { sessionId: 's1', role: 'user', content: 'I should sort out the garage', toolName: null, toolArgs: null },
      { sessionId: 's1', role: 'assistant', content: 'Sounds like we are converging.', toolName: 'mark_checkpoint', toolArgs: { project_summary: 'Sort out the garage' } },
      { sessionId: 's1', role: 'assistant', content: 'Now, what has to happen first?', toolName: null, toolArgs: null },
    ])
    // Second call: the checkpoint tool is gone, and the persisted tool
    // row round-trips as assistant tool_calls plus a synthetic tool result.
    const [secondMessages, secondTools] = complete.mock.calls[1] as unknown as [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ]
    expect(secondTools).toEqual([])
    const toolCallMessage = secondMessages.find((m) => m.role === 'assistant' && m.tool_calls)
    expect(toolCallMessage).toMatchObject({
      role: 'assistant',
      content: 'Sounds like we are converging.',
    })
    expect((toolCallMessage!.tool_calls as Array<Record<string, unknown>>)[0]).toMatchObject({
      type: 'function',
      function: {
        name: 'mark_checkpoint',
        arguments: '{"project_summary":"Sort out the garage"}',
      },
    })
    expect(secondMessages.at(-1)).toEqual({
      role: 'tool',
      tool_call_id: (toolCallMessage!.tool_calls as Array<{ id: string }>)[0]!.id,
      content: 'ok',
    })
  })

  it('stops offering mark_checkpoint once it has fired in an earlier turn', async () => {
    const state: FakeState = {
      messages: [
        { sessionId: 's1', role: 'user', content: 'garage', toolName: null, toolArgs: null },
        { sessionId: 's1', role: 'assistant', content: null, toolName: 'mark_checkpoint', toolArgs: { project_summary: 'Garage' } },
      ],
      projectSummary: 'Garage',
    }
    const complete = vi.fn().mockResolvedValue({ content: 'What comes first?', toolCalls: [] })
    const ports = makePorts(state, { complete })

    const result = await runInterviewTurn(ports, 's1', 'First, the shelves')

    expect(result.phase).toBe('Drilling')
    const [, tools] = complete.mock.calls[0] as unknown as [unknown[], Array<unknown>]
    expect(tools).toEqual([])
  })

  it('throws a retryable error when the model answers with neither content nor a usable tool call', async () => {
    const state: FakeState = { messages: [], projectSummary: null }
    const ports = makePorts(state, textLlm([{ content: null }]))

    await expect(runInterviewTurn(ports, 's1', 'idea')).rejects.toThrow(
      /neither content nor a usable tool call/i,
    )
    // The user message is already persisted; nothing else was invented.
    expect(state.messages).toHaveLength(1)
  })

  it('throws a retryable error on a mark_checkpoint call without a project_summary string', async () => {
    const state: FakeState = { messages: [], projectSummary: null }
    const complete = vi.fn().mockResolvedValue({
      content: null,
      toolCalls: [
        { id: 'call_1', type: 'function', function: { name: 'mark_checkpoint', arguments: '{}' } },
      ],
    })
    const ports = makePorts(state, { complete })

    await expect(runInterviewTurn(ports, 's1', 'idea')).rejects.toThrow(/project_summary/)
  })
})
