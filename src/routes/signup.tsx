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
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold tracking-tight">Sign up for Hone</h1>
      <AuthForm
        mode="sign-up"
        onSubmit={async (data) => {
          const result = await signUp({ data })
          if (result.ok) {
            await navigate({ to: '/' })
          }
          return result
        }}
      />
      <p className="text-sm text-neutral-500">
        Already have an account? <Link to="/login" className="underline">Log in</Link>
      </p>
    </main>
  )
}
