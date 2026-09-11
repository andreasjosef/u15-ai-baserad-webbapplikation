// Session read for use in server functions / route `beforeLoad` guards.
// Reads via `getRequestHeaders()`, not `request.headers` — the latter
// stopped working partway through TanStack Start's RC (docs/research.md
// §4.1, better-auth/better-auth#6818).
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { auth } from '../auth.ts'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: getRequestHeaders() })
})
