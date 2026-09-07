// Route guard for anything that requires a logged-in user: an anonymous
// visitor is redirected to the log-in route instead of seeing the page.
// Pure over the session value so it's testable without a router harness
// — routes call it from `beforeLoad` with the result of `getSession`.
//
// Named "auth session" rather than the domain's Session, which CONTEXT.md
// reserves for one interview_sessions row.
import { redirect } from '@tanstack/react-router'

import type { auth } from './auth.ts'

export type AuthSession = typeof auth.$Infer.Session

export function requireAuthSession(session: AuthSession | null): AuthSession {
  if (!session) {
    throw redirect({ to: '/login' })
  }
  return session
}
