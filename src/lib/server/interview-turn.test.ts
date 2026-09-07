// Tests for the Interview turn orchestrator. All side effects (db,
// OpenRouter) arrive as injected ports, so the multi-turn loop, tool
// persistence, Checkpoint transition, and Task Breakdown proposal are
// exercised in-memory.
import { describe, expect, it, vi } from 'vitest'

import {
  INTERVIEW_SYSTEM_PROMPT,
  MARK_CHECKPOINT_TOOL,
  PROPOSE_TASK_BREAKDOWN_TOOL,
} from './interview-prompt.ts'
import { runInterviewTurn, type InterviewPorts, type StoredMessage } from './interview-turn.ts'

interface FakeState {
  messages: Array<StoredMessage & { sessionId: string }>
  projectSummary: string | null
  projectTitle: string | null
  tasks: Array<Record<string, unknown> & { sessionId: string }>
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
    async updateSessionTitle(_sessionId, projectTitle) {
      state.projectTitle = projectTitle
    },
    async saveProposedTasks(sessionId, tasks) {
      for (const task of tasks) {
        state.tasks.push({ sessionId, ...task })
      }
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
    const state: FakeState = { messages: [], projectSummary: null, projectTitle: null, tasks: [] }
    const ports = makePorts(
      state,
      textLlm([{ content: 'What does "sorted out" actually mean to you?' }]),
    )

    const result = await runInterviewTurn(ports, 's1', 'I should sort out the garage')

    expect(result).toEqual({
      assistantReply: 'What does "sorted out" actually mean to you?',
      phase: 'Defining',
      projectSummary: null,
      projectTitle: null,
      firedCheckpoint: false,
      firedBreakdown: false,
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
      projectTitle: null,
      tasks: [],
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
    const state: FakeState = { messages: [], projectSummary: null, projectTitle: null, tasks: [] }
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
    // Second call: the checkpoint tool is swapped for the breakdown
    // tool (the mechanical guard), and the persisted tool row
    // round-trips as assistant tool_calls plus a synthetic tool result.
    const [secondMessages, secondTools] = complete.mock.calls[1] as unknown as [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ]
    expect(secondTools).toEqual([PROPOSE_TASK_BREAKDOWN_TOOL])
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
      projectTitle: null,
      tasks: [],
    }
    const complete = vi.fn().mockResolvedValue({ content: 'What comes first?', toolCalls: [] })
    const ports = makePorts(state, { complete })

    const result = await runInterviewTurn(ports, 's1', 'First, the shelves')

    expect(result.phase).toBe('Drilling')
    const [, tools] = complete.mock.calls[0] as unknown as [unknown[], Array<unknown>]
    expect(tools).toEqual([PROPOSE_TASK_BREAKDOWN_TOOL])
  })

  it('handles propose_task_breakdown: persists the tool row, caches the title, saves the tasks, and reports Proposed', async () => {
    const state: FakeState = {
      messages: [
        { sessionId: 's1', role: 'user', content: 'garage', toolName: null, toolArgs: null },
        { sessionId: 's1', role: 'assistant', content: null, toolName: 'mark_checkpoint', toolArgs: { project_summary: 'Garage' } },
      ],
      projectSummary: 'Garage',
      projectTitle: null,
      tasks: [],
    }
    const complete = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'Here is what has to happen.',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'propose_task_breakdown',
              arguments: JSON.stringify({
                project_title: 'Garage cleanup',
                tasks: [
                  { title: 'Clear out old boxes', priority: 'high', due_string: 'this weekend' },
                  { title: 'Take donations to the tip', description: 'The green bags' },
                ],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({ content: 'Your task list is ready to review.', toolCalls: [] })
    const ports = makePorts(state, { complete })

    const result = await runInterviewTurn(ports, 's1', 'I think that covers it')

    expect(result.firedBreakdown).toBe(true)
    expect(result.phase).toBe('Proposed')
    expect(result.projectTitle).toBe('Garage cleanup')
    expect(result.assistantReply).toBe('Your task list is ready to review.')
    expect(state.projectTitle).toBe('Garage cleanup')
    // Persisted tasks are normalized: missing priority defaults to
    // "normal", missing description/due date to null, position in order.
    expect(state.tasks).toEqual([
      { sessionId: 's1', title: 'Clear out old boxes', description: null, priority: 'high', dueString: 'this weekend', position: 0 },
      { sessionId: 's1', title: 'Take donations to the tip', description: 'The green bags', priority: 'normal', dueString: null, position: 1 },
    ])
    expect(state.messages).toEqual([
      { sessionId: 's1', role: 'user', content: 'garage', toolName: null, toolArgs: null },
      { sessionId: 's1', role: 'assistant', content: null, toolName: 'mark_checkpoint', toolArgs: { project_summary: 'Garage' } },
      { sessionId: 's1', role: 'user', content: 'I think that covers it', toolName: null, toolArgs: null },
      {
        sessionId: 's1',
        role: 'assistant',
        content: 'Here is what has to happen.',
        toolName: 'propose_task_breakdown',
        toolArgs: {
          project_title: 'Garage cleanup',
          tasks: [
            { title: 'Clear out old boxes', description: null, priority: 'high', dueString: 'this weekend' },
            { title: 'Take donations to the tip', description: 'The green bags', priority: 'normal', dueString: null },
          ],
        },
      },
      { sessionId: 's1', role: 'assistant', content: 'Your task list is ready to review.', toolName: null, toolArgs: null },
    ])
    // After the breakdown fires, no tools are offered at all.
    const [, thirdTools] = complete.mock.calls[1] as unknown as [unknown[], Array<unknown>]
    expect(thirdTools).toEqual([])
  })

  it('round-trips a persisted propose_task_breakdown row as a tool call with a synthetic result', async () => {
    const state: FakeState = {
      messages: [
        { sessionId: 's1', role: 'user', content: 'garage', toolName: null, toolArgs: null },
        {
          sessionId: 's1',
          role: 'assistant',
          content: null,
          toolName: 'propose_task_breakdown',
          toolArgs: { project_title: 'Garage cleanup', tasks: [{ title: 'Sweep the floor' }] },
        },
      ],
      projectSummary: 'Garage',
      projectTitle: 'Garage cleanup',
      tasks: [],
    }
    const complete = vi.fn().mockResolvedValue({ content: 'Review the list.', toolCalls: [] })
    const ports = makePorts(state, { complete })

    await runInterviewTurn(ports, 's1', 'Looks good')

    const [messages] = complete.mock.calls[0] as unknown as [
      Array<Record<string, unknown>>,
    ]
    const toolCallMessage = messages.find((m) => m.role === 'assistant' && m.tool_calls)
    expect((toolCallMessage!.tool_calls as Array<Record<string, unknown>>)[0]).toMatchObject({
      type: 'function',
      function: {
        name: 'propose_task_breakdown',
        arguments: JSON.stringify({
          project_title: 'Garage cleanup',
          tasks: [{ title: 'Sweep the floor' }],
        }),
      },
    })
    // The synthetic tool result follows the tool call directly, before
    // this turn's user message.
    const toolCallIndex = messages.findIndex((m) => m === toolCallMessage)
    expect(messages[toolCallIndex + 1]).toEqual({
      role: 'tool',
      tool_call_id: (toolCallMessage!.tool_calls as Array<{ id: string }>)[0]!.id,
      content: 'ok',
    })
  })

  it('throws a retryable error on a propose_task_breakdown call without tasks', async () => {
    const state: FakeState = {
      messages: [
        { sessionId: 's1', role: 'assistant', content: null, toolName: 'mark_checkpoint', toolArgs: { project_summary: 'Garage' } },
      ],
      projectSummary: 'Garage',
      projectTitle: null,
      tasks: [],
    }
    const complete = vi.fn().mockResolvedValue({
      content: null,
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'propose_task_breakdown', arguments: '{"project_title":"Garage","tasks":[]}' },
        },
      ],
    })
    const ports = makePorts(state, { complete })

    await expect(runInterviewTurn(ports, 's1', 'done')).rejects.toThrow(/tasks/)
    expect(state.tasks).toHaveLength(0)
    expect(state.projectTitle).toBeNull()
  })

  it('throws a retryable error when the model answers with neither content nor a usable tool call', async () => {
    const state: FakeState = { messages: [], projectSummary: null, projectTitle: null, tasks: [] }
    const ports = makePorts(state, textLlm([{ content: null }]))

    await expect(runInterviewTurn(ports, 's1', 'idea')).rejects.toThrow(
      /neither content nor a usable tool call/i,
    )
    // The user message is already persisted; nothing else was invented.
    expect(state.messages).toHaveLength(1)
  })

  it('throws a retryable error on a mark_checkpoint call without a project_summary string', async () => {
    const state: FakeState = { messages: [], projectSummary: null, projectTitle: null, tasks: [] }
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
