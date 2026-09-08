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
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Log in to Hone</h1>
      <AuthForm
        mode="log-in"
        onSubmit={async (data) => {
          const result = await signIn({ data })
          if (result.ok) {
            await navigate({ to: '/' })
          }
          return result
        }}
      />
      <p className="text-sm text-muted-foreground">
        New here?{' '}
        <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  )
}
