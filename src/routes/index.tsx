// The app home (issue #133) — the same route serves both a logged-out
// visitor (marketing view: Logo, how-it-works strip, sign-up/log-in CTAs)
// and a logged-in user (the dashboard). No redirect: `beforeLoad` just
// exposes the session (possibly null) to the component, which branches.
// The page's presentational component lives in components/home-view.tsx —
// this file exports nothing but the route itself, which keeps the
// bundler's code-splitting warning away.
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { HomePage } from '../components/home-view.tsx'
import { signOut } from '../lib/server/auth-actions.ts'
import { getSession } from '../lib/server/session.ts'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSession()
    return { session }
  },
  component: IndexPage,
})

function IndexPage() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  return (
    <HomePage
      user={session?.user ?? null}
      onLogIn={() => navigate({ to: '/login' })}
      onSignUp={() => navigate({ to: '/signup' })}
      onStartInterview={() => navigate({ to: '/interview' })}
      onOpenHistory={() => navigate({ to: '/history' })}
      onOpenSettings={() => navigate({ to: '/settings' })}
      onLogOut={async () => {
        const result = await signOut()
        if (result.ok) {
          await navigate({ to: '/login' })
        }
        return result
      }}
    />
  )
}
