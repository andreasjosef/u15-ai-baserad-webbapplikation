// Mounts Better Auth as a catch-all server route (docs/research.md §4.1),
// so every Better Auth endpoint (sign-up, sign-in, session, etc.) is
// reachable under /api/auth/*.
import { createFileRoute } from '@tanstack/react-router'

import { auth } from '../../../lib/auth.ts'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
