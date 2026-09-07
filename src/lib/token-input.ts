// Shared validation for the Todoist token form (issue #23) and the server
// function behind it — same function on both ends, same rules, mirroring
// auth-input.ts. Deliberately format-light: Todoist's personal token
// format is theirs to change, and the format that matters is verified
// for real when the token is first used against the Todoist API. What
// must hold here is only that something token-shaped was pasted at all.
import type { ParsedCredentials } from './auth-input.ts'

export interface TodoistTokenInput {
  token: string
}

export function parseTodoistToken(input: unknown): ParsedCredentials<TodoistTokenInput> {
  const token =
    typeof input === 'object' && input !== null && 'token' in input
      ? (input as { token: unknown }).token
      : input
  if (typeof token !== 'string' || token.trim().length === 0) {
    return { ok: false, message: 'Paste your Todoist API token.' }
  }
  return { ok: true, data: { token: token.trim() } }
}
