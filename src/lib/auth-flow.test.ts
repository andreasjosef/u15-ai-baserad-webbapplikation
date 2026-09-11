// Round-trip tests for the email+password auth flow (issue #22), at the
// declared testing seam: `auth.api` called directly, persistence against
// the real (local) Postgres — the same calls the sign-up / log-in /
// log-out server functions make. Cookies are carried between calls by
// rebuilding a request `Headers` from each response's `Set-Cookie`
// headers, mirroring what the browser + `tanstackStartCookies` do.
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from './server/db/client.ts'
import { user } from './server/db/schema/index.ts'
import { auth } from './auth.ts'

const PASSWORD = 'correct horse battery staple'

function requestHeadersWithCookies(responseHeaders: Headers): Headers {
  const headers = new Headers()
  for (const setCookie of responseHeaders.getSetCookie()) {
    headers.append('cookie', setCookie.split(';')[0]!)
  }
  return headers
}

function uniqueEmail(): string {
  return `auth-flow-${crypto.randomUUID()}@hone.test`
}

describe('email+password auth flow', () => {
  const createdEmails: string[] = []

  afterEach(async () => {
    for (const email of createdEmails) {
      await db.delete(user).where(eq(user.email, email))
    }
    createdEmails.length = 0
  })

  it('signs a new user up and establishes a session from the returned cookies', async () => {
    const email = uniqueEmail()
    createdEmails.push(email)

    const { response, headers } = await auth.api.signUpEmail({
      body: { name: 'Test User', email, password: PASSWORD },
      returnHeaders: true,
    })
    expect(response.user.email).toBe(email)
    expect(headers.get('set-cookie')).toContain('better-auth.session_token=')

    const session = await auth.api.getSession({
      headers: requestHeadersWithCookies(headers),
    })
    expect(session?.user.email).toBe(email)
    expect(session?.session.userId).toBe(response.user.id)
  })

  it('logs a returning user in with the right password and rejects the wrong one', async () => {
    const email = uniqueEmail()
    createdEmails.push(email)
    await auth.api.signUpEmail({
      body: { name: 'Test User', email, password: PASSWORD },
    })

    const { headers } = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      returnHeaders: true,
    })
    const session = await auth.api.getSession({
      headers: requestHeadersWithCookies(headers),
    })
    expect(session?.user.email).toBe(email)

    await expect(
      auth.api.signInEmail({
        body: { email, password: 'not the password' },
      }),
    ).rejects.toMatchObject({ status: 'UNAUTHORIZED' })
  })

  it('reads no session for an anonymous request', async () => {
    const session = await auth.api.getSession({ headers: new Headers() })
    expect(session).toBeNull()
  })

  it('logs a user out, ending their session', async () => {
    const email = uniqueEmail()
    createdEmails.push(email)
    await auth.api.signUpEmail({
      body: { name: 'Test User', email, password: PASSWORD },
    })
    const { headers } = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      returnHeaders: true,
    })
    const requestHeaders = requestHeadersWithCookies(headers)
    expect((await auth.api.getSession({ headers: requestHeaders }))?.user.email).toBe(email)

    await auth.api.signOut({ headers: requestHeaders })

    expect(await auth.api.getSession({ headers: requestHeaders })).toBeNull()
  })
})
