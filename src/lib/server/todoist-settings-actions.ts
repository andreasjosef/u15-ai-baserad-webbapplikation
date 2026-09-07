// Server functions behind the account settings page (issue #23): store a
// Todoist personal API token for the logged-in user, encrypted at rest
// per ADR-0002, and report — without ever returning the token itself —
// whether one is already saved. Mirrors server/auth-actions.ts: `auth.api`
// is called directly so cookies work inside server functions, and raw
// errors never cross the wire.
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import type { AuthResult } from '../auth-result.ts'
import { auth } from '../auth.ts'
import { GENERIC_FAILURE } from '../auth-result.ts'
import { parseTodoistToken } from '../token-input.ts'
import { db } from './db/client.ts'
import { user } from './db/schema/index.ts'
import { encryptToken, loadTokenEncryptionKey } from './token-crypto.ts'

// Deliberately returns a boolean, never the stored value: the settings
// page's only need is to say whether a token is saved (and better-auth is
// configured with `returned: false` for the field anyway — auth.ts).
export const getTodoistTokenStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ hasToken: boolean }> => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) {
      return { hasToken: false }
    }
    const [row] = await db
      .select({ todoistToken: user.todoistToken })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)
    return { hasToken: Boolean(row?.todoistToken) }
  },
)

export const saveTodoistToken = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const result = parseTodoistToken(input)
    if (!result.ok) {
      throw new Error(result.message)
    }
    return result.data
  })
  .handler(async ({ data }): Promise<AuthResult> => {
    try {
      const session = await auth.api.getSession({ headers: getRequestHeaders() })
      if (!session) {
        return { ok: false, message: 'You need to log in before saving a token.' }
      }
      // Encryption stays server-side (ADR-0002): the plaintext exists only
      // for the moment between the wire and this write.
      const encrypted = encryptToken(data.token, loadTokenEncryptionKey())
      await db.update(user).set({ todoistToken: encrypted }).where(eq(user.id, session.user.id))
      return { ok: true }
    } catch {
      // A missing/broken TOKEN_ENCRYPTION_KEY, a dropped connection, or a
      // wire-level rejection all land here as one retryable failure — no
      // silent success, no error detail worth leaking (plan.md §10).
      return GENERIC_FAILURE
    }
  })
