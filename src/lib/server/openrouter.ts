// Thin OpenRouter chat-completions client (issue #24). fetch is
// injected so the request/response mapping is testable without a
// network; the model is swappable via OPENROUTER_MODEL (plan.md §4:
// `anthropic/claude-sonnet-4.6` primary, `google/gemini-2.5-flash` for
// cheap iteration). The API key stays server-side — this module is
// only ever imported from server functions.
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const INTERVIEW_MODEL_ENV_VAR = 'OPENROUTER_MODEL'
export const DEFAULT_INTERVIEW_MODEL = 'anthropic/claude-sonnet-4.6'

export function resolveInterviewModel(env: Record<string, string | undefined>): string {
  return env[INTERVIEW_MODEL_ENV_VAR]?.trim() || DEFAULT_INTERVIEW_MODEL
}

export interface OpenRouterToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface OpenRouterRequestMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: OpenRouterToolCall[]
  tool_call_id?: string
}

export interface OpenRouterTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export interface OpenRouterResult {
  content: string | null
  toolCalls: OpenRouterToolCall[]
}

export interface OpenRouterClient {
  complete(
    messages: ReadonlyArray<OpenRouterRequestMessage>,
    tools: ReadonlyArray<OpenRouterTool>,
  ): Promise<OpenRouterResult>
}

type FetchImpl = typeof fetch

export function createOpenRouterClient(options: {
  apiKey: string
  model: string
  fetchImpl?: FetchImpl
}): OpenRouterClient {
  const doFetch = options.fetchImpl ?? fetch
  return {
    async complete(messages, tools) {
      const response = await doFetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          // An empty tools array would still advertise tool support to
          // some models — omit it entirely when there is nothing to offer.
          ...(tools.length > 0 ? { tools } : {}),
        }),
      })
      if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        throw new Error(
          `OpenRouter request failed with status ${response.status}${bodyText ? `: ${bodyText.slice(0, 300)}` : ''}`,
        )
      }
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; tool_calls?: OpenRouterToolCall[] } }>
      }
      const message = body.choices?.[0]?.message
      if (!message) {
        throw new Error('OpenRouter response contained no choices')
      }
      return {
        content: message.content ?? null,
        toolCalls: message.tool_calls ?? [],
      }
    },
  }
}
