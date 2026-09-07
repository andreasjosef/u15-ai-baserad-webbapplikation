// Server functions backing the sign-up / log-in / log-out flows
// (issue #22). Each calls `auth.api` directly — cookies are written
// through the `tanstackStartCookies` plugin, which works inside server
// functions (docs/research.md §4.1) — and return an `AuthResult` the
// forms render, so Better Auth's raw APIErrors never cross the wire.
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import {
  parseSignInCredentials,
  parseSignUpCredentials,
} from '../auth-input.ts'
import { toAuthResult, type AuthResult } from '../auth-result.ts'
import { auth } from '../auth.ts'

export const signUp = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const result = parseSignUpCredentials(input)
    if (!result.ok) {
      throw new Error(result.message)
    }
    return result.data
  })
  .handler(async ({ data }): Promise<AuthResult> => {
    try {
      await auth.api.signUpEmail({
        body: {
          name: data.name,
          email: data.email,
          password: data.password,
        },
        headers: getRequestHeaders(),
      })
      return { ok: true }
    } catch (error) {
      return toAuthResult(error, 'sign-up')
    }
  })

export const signIn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const result = parseSignInCredentials(input)
    if (!result.ok) {
      throw new Error(result.message)
    }
    return result.data
  })
  .handler(async ({ data }): Promise<AuthResult> => {
    try {
      await auth.api.signInEmail({
        body: { email: data.email, password: data.password },
        headers: getRequestHeaders(),
      })
      return { ok: true }
    } catch (error) {
      return toAuthResult(error, 'log-in')
    }
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  await auth.api.signOut({ headers: getRequestHeaders() })
})
