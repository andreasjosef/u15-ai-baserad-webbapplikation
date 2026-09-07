// The Interview route (issue #24). `beforeLoad` reuses the same guard as
// the home route; the conversation itself is single-sitting (plan.md
// §13) — the route always starts a fresh Session, and the transcript is
// kept in local state for the visit while the server persists every
// turn to `messages`.
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

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
  const [sessionId, setSessionId] = useState<string | null>(null)
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
      setPhase(result.phase)
      setProjectSummary(result.projectSummary)
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: message },
        { role: 'assistant', content: result.assistantReply },
      ])
      return { ok: true }
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
      onSubmit={handleSubmit}
    />
  )
}
