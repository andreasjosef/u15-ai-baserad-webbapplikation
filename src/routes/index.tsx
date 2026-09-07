// The app home — the first route that requires a logged-in user (issue
// #22). `beforeLoad` redirects an anonymous visitor to the log-in route
// and otherwise exposes the session to the component as route context.
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { requireSession } from '../lib/require-session.ts'
import { signOut } from '../lib/server/auth-actions.ts'
import { getSession } from '../lib/server/session.ts'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = requireSession(await getSession())
    return { session }
  },
  component: IndexPage,
})

function IndexPage() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  return (
    <HomePage
      user={session.user}
      onLogOut={async () => {
        await signOut()
        await navigate({ to: '/login' })
      }}
    />
  )
}

export function HomePage({
  user,
  onLogOut,
}: {
  user: { name: string; email: string }
  onLogOut: () => Promise<void>
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-5xl font-bold tracking-tight">Hone</h1>
      <p className="max-w-md text-lg text-neutral-500">
        Turn a vague idea into a concrete plan. Placeholder page — the
        interview is on its way.
      </p>
      <p className="text-sm text-neutral-600">
        Signed in as {user.name} ({user.email})
      </p>
      <button
        type="button"
        onClick={() => onLogOut()}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
      >
        Log out
      </button>
    </main>
  )
}
