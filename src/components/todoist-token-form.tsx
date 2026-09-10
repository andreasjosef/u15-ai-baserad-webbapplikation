// The token-entry form on the account settings page (issue #23). Mirrors
// AuthForm: validates with the same parser the server function uses,
// shows failures as a retryable alert, disables the button while pending.
// On success the field is cleared and a non-sensitive confirmation is
// shown — the plaintext token is never rendered back, per the ticket's
// acceptance criteria.
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { AuthResult } from '../lib/auth-result.ts'
import { GENERIC_FAILURE } from '../lib/auth-result.ts'
import { parseTodoistToken } from '../lib/token-input.ts'

export interface TokenSettingsFormProps {
  onSubmit: (data: { token: string }) => Promise<AuthResult>
}

export function TokenSettingsForm({ onSubmit }: TokenSettingsFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // React nulls `currentTarget` once the dispatch finishes — this handler
    // awaits, so the form node must be captured up front for the reset.
    const form = event.currentTarget
    const formData = new FormData(form)

    const parsed = parseTodoistToken({ token: formData.get('token') })
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }

    setError(null)
    setSaved(false)
    setPending(true)
    try {
      // The server-side validator re-runs the same parser, so its thrown
      // rejection is a should-never-happen defense — but a thrown error
      // crossing the wire still lands here as a retryable alert.
      const submitted = await onSubmit(parsed.data)
      if (submitted.ok) {
        form.reset()
        setSaved(true)
      } else {
        setError(submitted.message)
      }
    } catch {
      setError(GENERIC_FAILURE.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Todoist API token
        <Input
          name="token"
          type="password"
          autoComplete="off"
          // Screen-reader-friendly hint that matches the label's promise:
          // whatever is pasted here is stored, never shown back.
          placeholder="Paste your Todoist personal API token"
          className="h-10 rounded-md"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-primary">
          Token saved.
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-10 w-full rounded-md">
        {pending ? 'Saving…' : 'Save token'}
      </Button>
    </form>
  )
}
