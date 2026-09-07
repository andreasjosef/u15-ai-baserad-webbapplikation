// Maps Better Auth API failures onto the result shape the auth forms
// render. Kept pure so the mapping is testable without a request
// context — the server functions in server/auth-actions.ts just hand
// their caught errors here.
import { APIError } from 'better-auth'

export type AuthResult = { ok: true } | { ok: false; message: string }

export const GENERIC_FAILURE: { ok: false; message: string } = {
  ok: false,
  message: 'Something went wrong. Please try again.',
}

export function toAuthResult(error: unknown, flow: 'sign-up' | 'log-in'): AuthResult {
  if (!(error instanceof APIError)) {
    return GENERIC_FAILURE
  }
  if (error.status === 'UNPROCESSABLE_ENTITY' && flow === 'sign-up') {
    return {
      ok: false,
      message: 'An account with this email already exists. Try logging in instead.',
    }
  }
  if (error.status === 'UNAUTHORIZED') {
    return { ok: false, message: 'Invalid email or password.' }
  }
  return GENERIC_FAILURE
}
