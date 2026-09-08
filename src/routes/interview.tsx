// The Interview route (issues #24 and #25). `beforeLoad` reuses the same
// guard as the home route; the conversation itself is single-sitting
// (plan.md §13) — the route always starts a fresh Session, and the
// transcript is kept in local state for the visit while the server
// persists every turn to `messages`.
//
// This route hosts only the Defining and Drilling phases. The moment a
// turn's result indicates `propose_task_breakdown` fired (issue #56),
// it performs a real navigation to the review route (issue #55),
// addressed by the Session's id — it no longer fetches or holds the
// proposed breakdown's data, nor renders the review table or the
// wrapped-up state. Its own URL stays id-less; Defining/Drilling and the
// invisible Checkpoint are unaffected.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import { InterviewView, type InterviewMessage, type InterviewSubmitResult } from '../components/interview-view.tsx'
import type { Phase } from '../lib/phase.ts'
import { requireAuthSession } from '../lib/require-auth-session.ts'
import {
  INTERVIEW_FAILURE,
  sendInterviewMessage,
  startInterview,
} from '../lib/server/interview-actions.ts'
import { getSession } from '../lib/server/session.ts'

export const Route = createFileRoute('/interview')({
  beforeLoad: async () => {
    requireAuthSession(await getSession())
  },
  component: InterviewRoute,
})

function InterviewRoute() {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState<string | null>(null)
  // The nav callback fires right after a turn resolves, before this
  // component re-renders with the new session id — a ref carries the
  // latest id to it without a stale-closure race.
  const sessionIdRef = useRef<string | null>(null)
  const [messages, setMessages] = useState<Array<InterviewMessage>>([])
  const [phase, setPhase] = useState<Phase>('Defining')
  const [projectSummary, setProjectSummary] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(message: string): Promise<InterviewSubmitResult> {
    setPending(true)
    try {
      const result = sessionId
        ? await sendInterviewMessage({ data: { sessionId, message } })
        : await startInterview({ data: { message } })
      if (!result.ok) {
        return result
      }
      setSessionId(result.sessionId)
      sessionIdRef.current = result.sessionId
      setPhase(result.phase)
      setProjectSummary(result.projectSummary)
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: message },
        { role: 'assistant', content: result.assistantReply },
      ])
      // A proposed breakdown hands the rest of the Interview to the
      // review route — this route holds none of that data itself.
      return { ok: true, breakdownProposed: result.firedBreakdown }
    } catch {
      return { ok: false, message: INTERVIEW_FAILURE }
    } finally {
      setPending(false)
    }
  }

  return (
    <InterviewView
      messages={messages}
      pending={pending}
      phase={phase}
      projectSummary={projectSummary}
      onBreakdownProposed={() => {
        const id = sessionIdRef.current
        if (id) {
          void navigate({ to: '/interview/$sessionId', params: { sessionId: id } })
        }
      }}
      onSubmit={handleSubmit}
    />
  )
}
