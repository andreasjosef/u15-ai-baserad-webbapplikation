// Tests for the OpenRouter chat-completions client. fetch is injected,
// so these assert on the exact request mapping and the parsed response
// without any network.
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createOpenRouterClient,
  INTERVIEW_MODEL_ENV_VAR,
  resolveInterviewModel,
} from './openrouter.ts'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockFetch = vi.fn()

afterEach(() => {
  mockFetch.mockReset()
})

describe('resolveInterviewModel', () => {
  it('defaults to the primary model', () => {
    expect(resolveInterviewModel({})).toBe('anthropic/claude-sonnet-4.6')
  })

  it('swaps the model via the env var', () => {
    expect(resolveInterviewModel({ [INTERVIEW_MODEL_ENV_VAR]: 'google/gemini-2.5-flash' })).toBe(
      'google/gemini-2.5-flash',
    )
  })

  it('falls back to the default on an empty env value', () => {
    expect(resolveInterviewModel({ [INTERVIEW_MODEL_ENV_VAR]: '' })).toBe(
      'anthropic/claude-sonnet-4.6',
    )
  })
})

describe('createOpenRouterClient', () => {
  it('posts the chat-completions request with model, auth headers, messages, and tools', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { role: 'assistant', content: 'What should the end result be?' } }],
      }),
    )
    const client = createOpenRouterClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4.6', fetchImpl: mockFetch })

    const result = await client.complete(
      [
        { role: 'system', content: 'You are the interviewer.' },
        { role: 'user', content: 'I should sort out the garage' },
      ],
      [{ type: 'function', function: { name: 'mark_checkpoint', parameters: {} } }],
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('anthropic/claude-sonnet-4.6')
    expect(body.messages).toHaveLength(2)
    expect(body.tools).toHaveLength(1)
    expect(result).toEqual({
      content: 'What should the end result be?',
      toolCalls: [],
    })
  })

  it('surfaces tool calls from the response', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'mark_checkpoint',
                    arguments: '{"project_summary":"Sort out the garage"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    )
    const client = createOpenRouterClient({ apiKey: 'sk-test', model: 'm', fetchImpl: mockFetch })

    const result = await client.complete([{ role: 'user', content: 'hi' }], [])

    expect(result.content).toBeNull()
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]?.function.name).toBe('mark_checkpoint')
    expect(result.toolCalls[0]?.function.arguments).toBe('{"project_summary":"Sort out the garage"}')
  })

  it('throws a retryable error with the status on a non-200 response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: { message: 'rate limited' } }, 429))
    const client = createOpenRouterClient({ apiKey: 'sk-test', model: 'm', fetchImpl: mockFetch })

    await expect(client.complete([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      /OpenRouter request failed with status 429/,
    )
  })

  it('throws when the response has no choices', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ choices: [] }))
    const client = createOpenRouterClient({ apiKey: 'sk-test', model: 'm', fetchImpl: mockFetch })

    await expect(client.complete([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      /no choices/i,
    )
  })
})
