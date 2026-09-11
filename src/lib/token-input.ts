// Shared validation for the credential forms on the settings page and the
// server functions behind them — same function on both ends, same rules,
// mirroring auth-input.ts. Deliberately format-light: the providers' token
// formats are theirs to change, and the format that matters is verified
// for real when the credential is first used against the provider's API.
// What must hold here is only that something token-shaped was pasted at
// all (Todoist personal API token, issue #23; OpenRouter API key, #136).
import type { ParsedCredentials } from './auth-input.ts'

export interface TodoistTokenInput {
  token: string
}

export interface OpenRouterKeyInput {
  token: string
}

function parsePastedSecret(input: unknown, message: string): ParsedCredentials<{ token: string }> {
  const token =
    typeof input === 'object' && input !== null && 'token' in input
      ? (input as { token: unknown }).token
      : input
  if (typeof token !== 'string' || token.trim().length === 0) {
    return { ok: false, message }
  }
  return { ok: true, data: { token: token.trim() } }
}

export function parseTodoistToken(input: unknown): ParsedCredentials<TodoistTokenInput> {
  return parsePastedSecret(input, 'Paste your Todoist API token.')
}

export function parseOpenRouterKey(input: unknown): ParsedCredentials<OpenRouterKeyInput> {
  return parsePastedSecret(input, 'Paste your OpenRouter API key.')
}
