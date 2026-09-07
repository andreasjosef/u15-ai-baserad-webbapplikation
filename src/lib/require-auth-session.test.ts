import { isRedirect } from '@tanstack/router-core'
import { describe, expect, it } from 'vitest'

import { requireAuthSession } from './require-auth-session.ts'

const session = {
  user: { id: 'u1', email: 'person@example.com', name: 'Test User' },
  session: { id: 's1', userId: 'u1' },
} as never

describe('requireAuthSession', () => {
  it('returns the session when one exists', () => {
    expect(requireAuthSession(session)).toBe(session)
  })

  it('redirects anonymous visitors to the log-in route when there is no session', () => {
    try {
      requireAuthSession(null)
      expect.unreachable('requireAuthSession should have thrown a redirect')
    } catch (error) {
      expect(isRedirect(error)).toBe(true)
      expect((error as Response & { options: { to?: string } }).options.to).toBe('/login')
    }
  })
})
