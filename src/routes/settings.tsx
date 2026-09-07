// Account settings route (issue #23): where a logged-in user pastes their
// Todoist personal API token. `beforeLoad` reuses the same guard as the
// home route — an anonymous visitor is redirected to the log-in page —
// and loads only the *status* of the stored token (whether one exists);
// the token itself never crosses the wire, per ADR-0002.
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { TokenSettingsForm } from '../components/todoist-token-form.tsx'
import { requireAuthSession } from '../lib/require-auth-session.ts'
import { getSession } from '../lib/server/session.ts'
import {
  getTodoistTokenStatus,
  saveTodoistToken,
} from '../lib/server/todoist-settings-actions.ts'

export const Route = createFileRoute('/settings')({
  beforeLoad: async () => {
    const session = requireAuthSession(await getSession())
    const { hasToken } = await getTodoistTokenStatus()
    return { session, hasToken }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { session, hasToken } = Route.useRouteContext()
  // `beforeLoad` reads the saved-token status once per visit; a save inside
  // this visit updates it locally so the copy never goes stale.
  const [tokenSaved, setTokenSaved] = useState(hasToken)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <p className="text-sm text-neutral-600">
          Signed in as {session.user.name} ({session.user.email})
        </p>
        <p className="text-sm text-neutral-600">
          Paste the personal API token from your Todoist integrations settings
          so Hone can create tasks in your account. It is stored encrypted and
          never shown again — {tokenSaved
            ? 'a token is already saved.'
            : 'no token is saved yet.'}
        </p>
      </div>
      <TokenSettingsForm
        onSubmit={async (data) => {
          const result = await saveTodoistToken({ data })
          if (result.ok) {
            setTokenSaved(true)
          }
          return result
        }}
      />
      <Link to="/" className="text-sm underline">
        Back to Hone
      </Link>
    </main>
  )
}
