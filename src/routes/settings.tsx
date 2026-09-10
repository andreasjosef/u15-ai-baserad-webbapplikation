// Account settings route (issue #23): where a logged-in user pastes their
// Todoist personal API token. `beforeLoad` reuses the same guard as the
// home route — an anonymous visitor is redirected to the log-in page —
// and loads only the *status* of the stored token (whether one exists);
// the token itself never crosses the wire, per ADR-0002.
//
// PROTOTYPE (issue #44 + the general "still uses old styles" cleanup):
// this route also renders one of three `?variant=` layouts — see
// src/components/settings-variants/ — each restyled onto the app's real
// design system and each adding a stubbed bring-your-own-OpenRouter-key
// section (issue #44; storage/validation are a separate, later decision —
// this only prototypes the paste/validate/clear UI). The page is also
// wrapped in the real NavShell for this prototype, matching every other
// post-login screen — today's `/settings` is the one screen not inside
// it, which is the biggest single piece of "old style". Wiring NavShell
// here duplicates a few lines of src/routes/_shell.tsx rather than moving
// this file under `_shell/`, to keep the prototype's diff isolated from
// routeTree.gen.ts. If a variant wins, folding it in for real should
// make that move.
//
// A `PrototypeSwitcher` (bottom-center, dev-only) cycles the three; drop
// it and the losing variants once a decision is made — see
// .claude/skills/prototype/SKILL.md's capture step.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { NavShell } from '../components/nav-shell.tsx'
import { PrototypeSwitcher } from '../components/prototype-switcher.tsx'
import { VariantA } from '../components/settings-variants/variant-a-stacked-cards.tsx'
import { VariantB } from '../components/settings-variants/variant-b-grouped-list.tsx'
import { VariantC } from '../components/settings-variants/variant-c-two-pane.tsx'
import { useOpenRouterKeyStub } from '../components/settings-variants/use-openrouter-key-stub.ts'
import { requireAuthSession } from '../lib/require-auth-session.ts'
import { getSession } from '../lib/server/session.ts'
import {
  getTodoistTokenStatus,
  saveTodoistToken,
} from '../lib/server/todoist-settings-actions.ts'

const VARIANTS = [
  { key: 'A', label: 'Stacked cards' },
  { key: 'B', label: 'Grouped list' },
  { key: 'C', label: 'Two-pane sub-nav' },
] as const
type VariantKey = (typeof VARIANTS)[number]['key']

function isVariantKey(value: unknown): value is VariantKey {
  return typeof value === 'string' && VARIANTS.some((v) => v.key === value)
}

export const Route = createFileRoute('/settings')({
  // `variant` is genuinely optional — omitting the key (not setting it to
  // `undefined`) is what lets every other `navigate({ to: '/settings' })`
  // call in the app (the nav shell, the home page) skip `search` entirely.
  validateSearch: (search: Record<string, unknown>): { variant?: VariantKey } =>
    isVariantKey(search.variant) ? { variant: search.variant } : {},
  beforeLoad: async () => {
    const session = requireAuthSession(await getSession())
    const { hasToken } = await getTodoistTokenStatus()
    return { session, hasToken }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { session, hasToken } = Route.useRouteContext()
  const { variant } = Route.useSearch()
  const navigate = useNavigate()
  // `beforeLoad` reads the saved-token status once per visit; a save inside
  // this visit updates it locally so the copy never goes stale.
  const [tokenSaved, setTokenSaved] = useState(hasToken)
  const openRouterKey = useOpenRouterKeyStub()

  const activeVariant = variant ?? 'A'

  function setVariant(key: string) {
    void navigate({ to: '/settings', search: isVariantKey(key) ? { variant: key } : {} })
  }

  const variantProps = {
    userName: session.user.name,
    userEmail: session.user.email,
    tokenSaved,
    openRouterKey,
    onSubmitToken: async (data: { token: string }) => {
      const result = await saveTodoistToken({ data })
      if (result.ok) {
        setTokenSaved(true)
      }
      return result
    },
  }

  return (
    <NavShell
      settingsActive
      onNavigate={(item) => {
        void navigate({ to: item === 'history' ? '/history' : '/interview' })
      }}
      onNavigateHome={() => {
        void navigate({ to: '/' })
      }}
      onOpenSettings={() => {
        void navigate({ to: '/settings' })
      }}
    >
      {/* No "back to Hone" link here (unlike the pre-prototype version):
          inside the real NavShell the wordmark already covers that, and
          duplicating it was itself a symptom of this page not living in
          the shell before. */}
      {activeVariant === 'A' && <VariantA {...variantProps} />}
      {activeVariant === 'B' && <VariantB {...variantProps} />}
      {activeVariant === 'C' && <VariantC {...variantProps} />}

      <PrototypeSwitcher variants={VARIANTS} current={activeVariant} onChange={setVariant} />
    </NavShell>
  )
}
