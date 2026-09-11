// Shared validation for the Interview's idea box and message box
// (issue #24) and the server functions behind them — same function on
// both ends, same rules, mirroring auth-input.ts / token-input.ts.
// Format-light on purpose: the whole point of the Interview is that the
// idea starts vague, so the only hard rule is that something word-shaped
// was sent at all.
import type { ParsedCredentials } from './auth-input.ts'

const MAX_LENGTH = 2000

export function parseInterviewMessage(input: unknown): ParsedCredentials<{ message: string }> {
  const message =
    typeof input === 'object' && input !== null && 'message' in input
      ? (input as { message: unknown }).message
      : input
  if (typeof message !== 'string' || message.trim().length === 0) {
    return { ok: false, message: 'Write something first — even a rough sentence is enough.' }
  }
  if (message.length > MAX_LENGTH) {
    return { ok: false, message: `Keep it under ${MAX_LENGTH} characters.` }
  }
  return { ok: true, data: { message: message.trim() } }
}
