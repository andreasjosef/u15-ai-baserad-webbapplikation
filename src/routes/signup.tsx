// Sign-up route (issue #22). Creates the account, signs the new user in
// (Better Auth's sign-up also establishes the session cookie), then
// lands on `/`.
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthForm } from '../components/auth-form.tsx'
import { signUp } from '../lib/server/auth-actions.ts'

export const Route = createFileRoute('/signup')({
  component: SignUpPage,
})

function SignUpPage() {
  const navigate = useNavigate()
  const onSubmit = async (data: { name: string; email: string; password: string }) => {
    const result = await signUp({ data })
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
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Sign up for Hone</h1>
        <AuthForm mode="sign-up" onSubmit={onSubmit} />
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/login"
            className="rounded-md border-2 border-border px-3 py-1 font-medium text-foreground hover:bg-background"
          >
            Log in
          </Link>
        </p>
      </main>
    </div>
  )
}
