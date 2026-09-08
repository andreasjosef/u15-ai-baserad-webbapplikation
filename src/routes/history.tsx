// The History route (issue #27). `beforeLoad` reuses the same guard as
// the other routes; the list itself loads once on mount and the
// per-session expansion is delegated to the pure HistoryView component
// with the detail loader wired to getHistoryDetail.
//
// Read-only by design (plan.md §13): every Phase shows, including
// Defining/Drilling/Proposed, but nothing here links back into
// /interview — an abandoned Interview is simply restarted as a
// brand-new Session.
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { HistoryView, type HistorySessionRow } from '../components/history-view.tsx'
import { requireAuthSession } from '../lib/require-auth-session.ts'
import {
  getHistory,
  getHistoryDetail,
  HISTORY_FAILURE,
} from '../lib/server/history-actions.ts'
import { getSession } from '../lib/server/session.ts'

export const Route = createFileRoute('/history')({
  beforeLoad: async () => {
    requireAuthSession(await getSession())
  },
  component: HistoryRoute,
})

function HistoryRoute() {
  const [sessions, setSessions] = useState<Array<HistorySessionRow> | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadHistory(): Promise<void> {
    setError(null)
    try {
      const result = await getHistory()
      if (result.ok) {
        setSessions(result.sessions)
      } else {
        setError(result.message)
      }
    } catch {
      setError(HISTORY_FAILURE)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  if (sessions === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p role="status" className="text-sm text-neutral-500">
          {error ?? 'Loading…'}
        </p>
        {error && (
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            Retry
          </button>
        )}
      </main>
    )
  }

  return (
    <HistoryView
      sessions={sessions}
      onOpenSession={async (sessionId) => {
        try {
          return await getHistoryDetail({ data: { sessionId } })
        } catch {
          return { ok: false, message: HISTORY_FAILURE }
        }
      }}
    />
  )
}
