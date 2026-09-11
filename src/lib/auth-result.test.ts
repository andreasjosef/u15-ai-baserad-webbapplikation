import { APIError } from 'better-auth'
import { describe, expect, it } from 'vitest'

import { toAuthResult } from './auth-result.ts'

describe('toAuthResult', () => {
  it("maps Better Auth's duplicate-email error to a sign-up-specific message", () => {
    const error = new APIError('UNPROCESSABLE_ENTITY', {
      message: 'User already exists',
    })
    expect(toAuthResult(error, 'sign-up')).toEqual({
      ok: false,
      message: 'An account with this email already exists. Try logging in instead.',
    })
  })

  it("maps Better Auth's bad-credentials error to a log-in-specific message", () => {
    const error = new APIError('UNAUTHORIZED', {
      message: 'Invalid email or password',
    })
    expect(toAuthResult(error, 'log-in')).toEqual({
      ok: false,
      message: 'Invalid email or password.',
    })
  })

  it('maps anything else to a generic retryable message (no silent failures)', () => {
    const error = new APIError('INTERNAL_SERVER_ERROR', { message: 'boom' })
    expect(toAuthResult(error, 'log-in')).toEqual({
      ok: false,
      message: 'Something went wrong. Please try again.',
    })
  })

  it('treats non-APIError values as generic failures too', () => {
    expect(toAuthResult(new Error('database on fire'), 'sign-up')).toEqual({
      ok: false,
      message: 'Something went wrong. Please try again.',
    })
  })
})
