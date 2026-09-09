// Shared validation for the sign-up / log-in forms and the server
// functions behind them. Parsed client-side (for instant feedback) and
// again inside the server-function validator (never trust the wire) —
// same function, same rules, so both ends agree on what's valid.
//
// The password minimum matches Better Auth's own default
// (`minPasswordLength: 8`), so locally-rejected input can never bounce
// off Better Auth with a less friendly error.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

// The repo's generic "parsed, or a user-facing reason why not" result.
// Named for its first use (auth), but reused verbatim by every other
// input parser — interview messages (interview-input.ts), Todoist tokens
// (token-input.ts), task edits and proposed breakdowns (task-input.ts).
// Read the name as "ParseResult<T>"; the `Credentials` is historical.
export type ParsedCredentials<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export interface SignInInput {
  email: string
  password: string
}

export interface SignUpInput extends SignInInput {
  name: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return EMAIL_PATTERN.test(email) ? email : null
}

function parsePassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return value
}

export function parseSignInCredentials(input: unknown): ParsedCredentials<SignInInput> {
  if (!isRecord(input)) {
    return { ok: false, message: 'Enter your email and password.' }
  }
  const email = parseEmail(input.email)
  if (!email) {
    return { ok: false, message: 'Enter a valid email address.' }
  }
  const password = parsePassword(input.password)
  if (!password) {
    return { ok: false, message: 'Enter your password.' }
  }
  return { ok: true, data: { email, password } }
}

export function parseSignUpCredentials(input: unknown): ParsedCredentials<SignUpInput> {
  if (!isRecord(input)) {
    return { ok: false, message: 'Enter your name, email and password.' }
  }
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) {
    return { ok: false, message: 'Enter your name.' }
  }
  const signInResult = parseSignInCredentials(input)
  if (!signInResult.ok) {
    return signInResult
  }
  const { password } = signInResult.data
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    }
  }
  return {
    ok: true,
    data: { name, email: signInResult.data.email, password },
  }
}
