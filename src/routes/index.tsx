// The app home — the first route that requires a logged-in user (issue
// #22). `beforeLoad` redirects an anonymous visitor to the log-in route
// and otherwise exposes the session to the component as route context.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import type { AuthResult } from '../lib/auth-result.ts'
import { requireAuthSession } from '../lib/require-auth-session.ts'
import { signOut } from '../lib/server/auth-actions.ts'
import { getSession } from '../lib/server/session.ts'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = requireAuthSession(await getSession())
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

export function HomePage({
  user,
  onLogOut,
  onOpenSettings,
}: {
  user: { name: string; email: string }
  onLogOut: () => Promise<AuthResult>
  // Navigation arrives as a prop (like onLogOut) so this exported component
  // stays renderable outside a router context — its tests do exactly that.
  onOpenSettings: () => void
}) {
  const [error, setError] = useState<string | null>(null)
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
        onClick={async () => {
          const result = await onLogOut()
          if (!result.ok) {
            setError(result.message)
          }
        }}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
      >
        Log out
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        className="text-sm text-neutral-600 underline hover:text-neutral-900"
      >
        Account settings
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  )
}
