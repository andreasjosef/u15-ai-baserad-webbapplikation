// Route-level tests for the Interview route (issue #96): the real
// component from interview.tsx, rendered through a minimal in-memory
// router so `useNavigate` and the `beforeLoad` guard have a context to
// run in. The server functions (startInterview / sendInterviewMessage)
// are mocked with deferred promises, so the tests can look at the
// transcript *while a turn is still pending* — the exact ordering the
// optimistic user bubble lives or dies by.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'

import { INTERVIEW_FAILURE, sendInterviewMessage, startInterview } from '../../lib/server/interview-actions.ts'
import { Route as InterviewFileRoute } from './interview.tsx'

vi.mock('../../lib/server/interview-actions.ts', () => ({
  INTERVIEW_FAILURE: 'Something went wrong reaching the interviewer. Try again.',
  startInterview: vi.fn(),
  sendInterviewMessage: vi.fn(),
}))

// The route's `beforeLoad` guard runs on the router's initial load.
vi.mock('../../lib/require-auth-session.ts', () => ({
  requireAuthSession: vi.fn((session: unknown) => session),
}))
vi.mock('../../lib/server/session.ts', () => ({
  getSession: vi.fn(async () => ({ user: { id: 'user-1' } })),
}))

// The full success shape of a server turn (interview-actions.ts's
// InterviewTurnResult) — every field the route reads.
function successfulTurn(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ok: true as const,
    sessionId: 'session-1',
    assistantReply: 'What does "sorted out" mean to you?',
    phase: 'Defining' as const,
    projectSummary: null,
    projectTitle: null,
    firedCheckpoint: false,
    firedBreakdown: false,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function renderInterviewRoute() {
  // Rebuilds the file's route inside a hand-rolled two-route tree — the
  // generated routeTree would drag in every other route's server graph.
  // The real component (and therefore the real submit flow) is mounted
  // as-is; the route's beforeLoad guard is exercised elsewhere.
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const interviewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/interview',
    component: InterviewFileRoute.options.component,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([interviewRoute]),
    history: createMemoryHistory({ initialEntries: ['/interview'] }),
  })
  render(<RouterProvider router={router} />)
  // The router's initial load (beforeLoad guard included) resolves
  // asynchronously — wait for the invitation before driving the composer.
  return screen.findByText('What should we Hone?')
}

async function submitMessage(text: string) {
  const textarea = screen.getByLabelText(/idea|answer/i)
  fireEvent.change(textarea, { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /start|send/i }))
}

describe('Interview route — optimistic user bubble (issue #96)', () => {
  it('shows the user bubble and typing indicator while the first turn is still pending', async () => {
    const pending = deferred<unknown>()
    vi.mocked(startInterview).mockReturnValue(pending.promise as never)
    await renderInterviewRoute()

    await submitMessage('I should sort out the garage')

    // The bubble is there before the server has answered anything.
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('I should sort out the garage')
    // And the typing indicator sits right below it, where the reply lands.
    expect(items[1].querySelectorAll('span')).toHaveLength(3)

    act(() => {
      pending.resolve(successfulTurn())
    })
    await screen.findByText('What does "sorted out" mean to you?')
    // The user's message is not appended a second time on resolve.
    expect(screen.getAllByText('I should sort out the garage')).toHaveLength(1)
  })

  it('shows the user bubble optimistically on a mid-Interview turn too', async () => {
    vi.mocked(startInterview).mockResolvedValue(successfulTurn())
    await renderInterviewRoute()
    await submitMessage('I should sort out the garage')
    await screen.findByText('What does "sorted out" mean to you?')
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()

    const pending = deferred<unknown>()
    vi.mocked(sendInterviewMessage).mockReturnValue(pending.promise as never)
    await submitMessage('Everything out, floor swept')

    const items = screen.getAllByRole('listitem')
    expect(items[items.length - 1].querySelectorAll('span')).toHaveLength(3)
    expect(items[items.length - 2]).toHaveTextContent('Everything out, floor swept')

    act(() => {
      pending.resolve(
        successfulTurn({ assistantReply: 'When do you want it done?' }),
      )
    })
    await screen.findByText('When do you want it done?')
    expect(screen.getAllByText('Everything out, floor swept')).toHaveLength(1)
  })

  it('removes the optimistic bubble again on a failed turn, keeping the retry alert', async () => {
    vi.mocked(startInterview).mockResolvedValue(successfulTurn())
    await renderInterviewRoute()
    await submitMessage('I should sort out the garage')
    await screen.findByText('What does "sorted out" mean to you?')

    const failure = deferred<unknown>()
    vi.mocked(sendInterviewMessage).mockReturnValue(failure.promise as never)
    await submitMessage('Everything out, floor swept')
    // Shown as sent while pending — the bubble is in the transcript (the
    // draft also still sits in the composer, which clears only on success).
    expect(screen.getByRole('list')).toHaveTextContent('Everything out, floor swept')

    act(() => {
      failure.resolve({ ok: false, message: INTERVIEW_FAILURE })
    })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i))
    // Nothing shown as sent — the bubble is gone, matching the message
    // staying in the composer for retry.
    expect(screen.getByRole('list')).not.toHaveTextContent('Everything out, floor swept')
    expect(screen.getByLabelText(/answer/i)).toHaveValue('Everything out, floor swept')
  })
})
