// Shared credentials form for log-in and sign-up (issue #22). Validates
// with the same parsers the server functions use (client feedback is
// instant, and both ends agree on the rules), shows failures from the
// submitted action as an alert, and disables the submit button while
// the action is pending. Navigation on success is the route's job.
import { useState, type FormEvent } from 'react'

import {
  parseSignInCredentials,
  parseSignUpCredentials,
  type ParsedCredentials,
  type SignInInput,
  type SignUpInput,
} from '../lib/auth-input.ts'
import { GENERIC_FAILURE, type AuthResult } from '../lib/auth-result.ts'

export interface AuthFormProps {
  mode: 'log-in' | 'sign-up'
  onSubmit: (data: { name: string; email: string; password: string }) => Promise<AuthResult>
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    // A ternary here would collapse the two ParsedCredentials variants
    // (subtype reduction: SignUpInput is a subtype of SignInInput), so
    // the declared union is built with plain if/else instead.
    let parsed: ParsedCredentials<SignUpInput> | ParsedCredentials<SignInInput>
    if (mode === 'sign-up') {
      parsed = parseSignUpCredentials({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
      })
    } else {
      parsed = parseSignInCredentials({
        email: formData.get('email'),
        password: formData.get('password'),
      })
    }
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }

    setError(null)
    setPending(true)
    try {
      // The server-side validator re-runs the same parser, so its thrown
      // rejection is a should-never-happen defense — but a thrown error
      // crossing the wire still lands here as a retryable alert.
      const submitted = await onSubmit({
        name: 'name' in parsed.data ? parsed.data.name : '',
        email: parsed.data.email,
        password: parsed.data.password,
      })
      if (!submitted.ok) {
        setError(submitted.message)
      }
    } catch {
      setError(GENERIC_FAILURE.message)
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
