// The app home — the first route that requires a logged-in user (issue
// #22). `beforeLoad` redirects an anonymous visitor to the log-in route
// and otherwise exposes the session to the component as route context.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

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

export function HomePage({
  user,
  onLogOut,
  onOpenHistory,
  onOpenSettings,
  onStartInterview,
}: {
  user: { name: string; email: string }
  onLogOut: () => Promise<AuthResult>
  // Navigation arrives as a prop (like onLogOut) so this exported component
  // stays renderable outside a router context — its tests do exactly that.
  onOpenHistory: () => void
  onOpenSettings: () => void
  onStartInterview: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="font-heading text-5xl font-normal tracking-[0.2em] uppercase">Hone</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Turn a vague idea into a concrete plan, one question at a time.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Button type="button" size="lg" onClick={onStartInterview} className="rounded-full px-8">
          Start an interview
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onOpenHistory}
          className="rounded-full px-6"
        >
          View history
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Signed in as {user.name} ({user.email})
      </p>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            const result = await onLogOut()
            if (!result.ok) {
              setError(result.message)
            }
          }}
        >
          Log out
        </Button>
        <Button type="button" variant="link" onClick={onOpenSettings}>
          Account settings
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  )
}
