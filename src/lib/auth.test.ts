import { describe, expect, it } from 'vitest'

import { auth } from './auth.ts'

describe('auth config', () => {
  it('registers the tanstackStartCookies plugin last, so sign-in/up cookies actually get written', () => {
    const plugins = auth.options.plugins ?? []
    expect(plugins.length).toBeGreaterThan(0)
    expect(plugins.at(-1)?.id).toBe('tanstack-start-cookies')
  })

  it("keeps todoistToken out of the sign-up/update-user API and the client-facing user shape (ADR-0002: never client-visible after entry)", () => {
    const field = auth.options.user?.additionalFields?.todoistToken
    expect(field).toMatchObject({
      type: 'string',
      required: false,
      input: false,
      returned: false,
    })
  })

  it("keeps openrouterApiKey out of the sign-up/update-user API and the client-facing user shape, like todoistToken (ADR-0002, issue #136)", () => {
    const field = auth.options.user?.additionalFields?.openrouterApiKey
    expect(field).toMatchObject({
      type: 'string',
      required: false,
      input: false,
      returned: false,
    })
  })
})
