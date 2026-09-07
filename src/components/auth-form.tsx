// Shared credentials form for log-in and sign-up (issue #22). Validates
// with the same parsers the server functions use (client feedback is
// instant, and both ends agree on the rules), shows failures from the
// submitted action as an alert, and disables the submit button while
// the action is pending. Navigation on success is the route's job.
import { useState, type FormEvent } from 'react'

import {
  parseSignInCredentials,
  parseSignUpCredentials,
} from '../lib/auth-input.ts'
import type { AuthResult } from '../lib/auth-result.ts'

export interface AuthFormProps {
  mode: 'log-in' | 'sign-up'
  onSubmit: (data: { name: string; email: string; password: string }) => Promise<AuthResult>
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    if (mode === 'sign-up') {
      const result = parseSignUpCredentials({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      await submit(result.data)
      return
    }

    const result = parseSignInCredentials({
      email: formData.get('email'),
      password: formData.get('password'),
    })
    if (!result.ok) {
      setError(result.message)
      return
    }
    await submit(result.data)
  }

  async function submit(data: { name?: string; email: string; password: string }) {
    setError(null)
    setPending(true)
    try {
      const result = await onSubmit({
        name: data.name ?? '',
        email: data.email,
        password: data.password,
      })
      if (!result.ok) {
        setError(result.message)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {mode === 'sign-up' && (
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            type="text"
            autoComplete="name"
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {mode === 'sign-up'
          ? pending
            ? 'Creating account…'
            : 'Sign up'
          : pending
            ? 'Logging in…'
            : 'Log in'}
      </button>
    </form>
  )
}
