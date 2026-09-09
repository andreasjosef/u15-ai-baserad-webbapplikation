// Log-in route (issue #22). On success the session cookie is already
// written by the server function; navigating to `/` re-runs its
// `beforeLoad` guard, which now finds the session.
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthForm } from '../components/auth-form.tsx'
import { signIn } from '../lib/server/auth-actions.ts'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const onSubmit = async (data: { name: string; email: string; password: string }) => {
    const result = await signIn({ data })
    if (result.ok) {
      await navigate({ to: '/' })
    }
    return result
  }
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background px-6 py-4 text-center">
        <span className="font-heading text-lg font-semibold tracking-[0.2em] uppercase">Hone</span>
      </header>
      <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-16">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Log in to Hone</h1>
        <AuthForm mode="log-in" onSubmit={onSubmit} />
        <p className="text-sm text-muted-foreground">
          New here?{' '}
          <Link
            to="/signup"
            className="rounded-md border-2 border-border px-3 py-1 font-medium text-foreground hover:bg-background"
          >
            Sign up
          </Link>
        </p>
      </main>
    </div>
  )
}
