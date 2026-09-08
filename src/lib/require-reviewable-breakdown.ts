// Route guard for the Task Breakdown review route (issue #55), mirroring
// require-auth-session.ts: a pure, directly-testable function over its
// inputs that redirects on failure. The route feeds it the result of the
// task-breakdown fetch keyed by the URL's session id — a Session the
// signed-in user doesn't own, one that doesn't exist (both read as a
// failed fetch, since the fetch is ownership-checked server-side), or
// one that hasn't reached the Proposed phase all redirect to the
// conversation route. Anything that returns is a Proposed or Completed
// Session the user owns, handed back for the route to render.
import { redirect } from '@tanstack/react-router'

import type { TaskBreakdownResult } from './server/interview-actions.ts'

export type ReviewableBreakdown = Extract<TaskBreakdownResult, { ok: true }>

export function requireReviewableBreakdown(breakdown: TaskBreakdownResult): ReviewableBreakdown {
  if (breakdown.ok && (breakdown.phase === 'Proposed' || breakdown.phase === 'Completed')) {
    return breakdown
  }
  throw redirect({ to: '/interview' })
}
