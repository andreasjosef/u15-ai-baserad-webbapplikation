// Account settings route (issue #23, reworked by #135, extended by #136):
// where a logged-in user pastes their Todoist personal API token and their
// own OpenRouter API key. Now nested under the pathless `_shell` layout —
// the URL stays `/settings`, but the screen renders inside the NavShell
// chrome like every other post-login screen. `beforeLoad` reuses the same
// guard as the shell's child routes — an anonymous visitor is redirected
// to the log-in page — and loads only the *status* of each stored
// credential (whether one exists); neither the token nor the key ever
// crosses the wire, per ADR-0002.
//
// The presentational work lives in components/settings-view.tsx; this
// file exports nothing but the route itself, which keeps the bundler's
// code-splitting warning away. Back-navigation is injected as an
// `onBack` callback: returning to the user's actual referrer — the
// `from` search param every settings entry point passes, falling back
// to Home when there is none (deep link). router.history.push (not
// navigate) takes the raw path, which also covers `/interview/$sessionId`
// referrers without needing to reconstruct their params.
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { SettingsView } from '../../components/settings-view.tsx'
import { requireAuthSession } from '../../lib/require-auth-session.ts'
import { getSession } from '../../lib/server/session.ts'
import {
  clearOpenRouterKey,
  getOpenRouterKeyStatus,
  saveOpenRouterKey,
} from '../../lib/server/openrouter-settings-actions.ts'
import {
  getTodoistTokenStatus,
  saveTodoistToken,
} from '../../lib/server/todoist-settings-actions.ts'

// The `from` param carries the path of the screen that opened settings.
// Same-origin paths only, so a crafted link can't push the user
// somewhere off-app on "back".
function validateSearch(search: Record<string, unknown>): { from?: string } {
  const from = search.from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? { from }
    : {}
}

export const Route = createFileRoute('/_shell/settings')({
  validateSearch,
  beforeLoad: async () => {
    const session = requireAuthSession(await getSession())
    const [{ hasToken }, { hasKey }] = await Promise.all([
      getTodoistTokenStatus(),
      getOpenRouterKeyStatus(),
    ])
    return { session, hasToken, hasKey }
  },
  component: SettingsPage,
})

// Human label for the back-link target, derived from the referrer path.
// The Task Breakdown review (`/interview/$sessionId`) labels as Interview
// — it is that screen's review surface.
function backLabelFor(from: string | undefined): string {
  if (from === undefined || from === '/') return 'Hone'
  if (from.startsWith('/interview')) return 'Interview'
  if (from === '/history') return 'History'
  return 'Hone'
}

function SettingsPage() {
  const { session, hasToken, hasKey } = Route.useRouteContext()
  const { from } = Route.useSearch()
  const router = useRouter()

  // `beforeLoad` reads each saved-credential status once per visit; a save
  // or clear inside this visit updates it locally so the copy never goes
  // stale.
  const [tokenSaved, setTokenSaved] = useState(hasToken)
  const [keySaved, setKeySaved] = useState(hasKey)
  return (
    <SettingsView
      userName={session.user.name}
      userEmail={session.user.email}
      tokenSaved={tokenSaved}
      keySaved={keySaved}
      backLabel={backLabelFor(from)}
      onBack={() => {
        router.history.push(from ?? '/')
      }}
      onSubmitToken={async (data) => {
        const result = await saveTodoistToken({ data })
        if (result.ok) {
          setTokenSaved(true)
        }
        return result
      }}
      onSubmitOpenRouterKey={async (data) => {
        const result = await saveOpenRouterKey({ data })
        if (result.ok) {
          setKeySaved(true)
        }
        return result
      }}
      onClearOpenRouterKey={async () => {
        const result = await clearOpenRouterKey()
        if (result.ok) {
          setKeySaved(false)
        }
        return result
      }}
    />
  )
}
