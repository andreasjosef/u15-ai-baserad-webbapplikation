// Tests for the Task Breakdown review route's access guard (issue #55).
// Pure like requireAuthSession: the guard receives the task-breakdown
// fetch result keyed by the URL's session id and either passes it
// through or throws a redirect — no router, db, or network here.
import { isRedirect } from '@tanstack/router-core'
import { describe, expect, it } from 'vitest'

import type { TaskBreakdownResult } from './server/interview-actions.ts'
import { requireReviewableBreakdown } from './require-reviewable-breakdown.ts'

const proposed: TaskBreakdownResult = {
  ok: true,
  phase: 'Proposed',
  projectTitle: 'Garage cleanup',
  todoistProjectId: null,
  tasks: [
    { id: 't1', title: 'Clear out old boxes', description: null, priority: 'high', dueString: null, position: 0 },
  ],
}

function redirectTarget(breakdown: TaskBreakdownResult): string {
  try {
    requireReviewableBreakdown(breakdown)
    return 'proceeded'
  } catch (error) {
    if (!isRedirect(error)) {
      throw error
    }
    return (error as Response & { options: { to?: string } }).options.to ?? ''
  }
}

describe('requireReviewableBreakdown', () => {
  it('proceeds for an owned Session in the Proposed phase, passing the breakdown through', () => {
    expect(requireReviewableBreakdown(proposed)).toBe(proposed)
  })

  it('proceeds for an owned Session in the Completed phase', () => {
    const completed: TaskBreakdownResult = {
      ok: true,
      phase: 'Completed',
      projectTitle: 'Garage cleanup',
      todoistProjectId: 'proj123',
      tasks: [],
    }
    expect(requireReviewableBreakdown(completed)).toBe(completed)
  })

  it('redirects to the conversation route for a Session the user does not own', () => {
    expect(redirectTarget({ ok: false, message: 'That Interview could not be found.' })).toBe('/interview')
  })

  it('redirects to the conversation route when the Session does not exist', () => {
    expect(redirectTarget({ ok: false, message: 'That Interview could not be found.' })).toBe('/interview')
  })

  it('redirects to the conversation route while the Session is still Defining', () => {
    const defining: TaskBreakdownResult = {
      ok: true,
      phase: 'Defining',
      projectTitle: null,
      todoistProjectId: null,
      tasks: [],
    }
    expect(redirectTarget(defining)).toBe('/interview')
  })

  it('redirects to the conversation route while the Session is still Drilling', () => {
    const drilling: TaskBreakdownResult = {
      ok: true,
      phase: 'Drilling',
      projectTitle: null,
      todoistProjectId: null,
      tasks: [],
    }
    expect(redirectTarget(drilling)).toBe('/interview')
  })
})
