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

// The "how it works" strip from the B2 home redesign (issue #98) — new
// copy/structure Home didn't carry before, giving the page something to
// explain the product with beyond two buttons.
const STEPS = [
  { eyebrow: '1', title: 'Answer a few questions' },
  { eyebrow: '2', title: 'Get a concrete plan' },
  { eyebrow: '3', title: 'Sync it to Todoist' },
]

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
    <div className="min-h-screen bg-muted/40">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <h1 className="font-heading text-lg font-semibold tracking-[0.2em] uppercase">Hone</h1>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onOpenSettings} className="rounded-md">
            Account settings
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              const result = await onLogOut()
              if (!result.ok) {
                setError(result.message)
              }
            }}
            className="rounded-md border-2"
          >
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
        <section className="rounded-lg border-2 border-border bg-background p-10 text-center shadow-sm">
          <h2 className="font-heading text-4xl font-semibold tracking-tight">
            Turn a vague idea into a concrete plan.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">One question at a time.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={onStartInterview}
              className="h-11 rounded-md border-2 border-foreground/10 px-6 text-base font-semibold"
            >
              Start an interview
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onOpenHistory}
              className="h-11 rounded-md border-2 px-6 text-base"
            >
              View history
            </Button>
          </div>
        </section>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-md border-2 border-border bg-background p-5">
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                Step {step.eyebrow}
              </p>
              <p className="mt-1 font-medium">{step.title}</p>
            </div>
          ))}
        </section>
        <p className="text-center text-sm text-muted-foreground">
          Signed in as {user.name} ({user.email})
        </p>
        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </main>
    </div>
  )
}
