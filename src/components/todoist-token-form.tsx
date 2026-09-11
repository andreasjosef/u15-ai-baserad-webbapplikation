// The credential-entry form behind the settings page's rows (issue #23;
// parameterized for the OpenRouter key row by #136). Mirrors AuthForm:
// validates with the same parser the server function uses, shows failures
// as a retryable alert, disables the buttons while pending. On success the
// field is cleared and a non-sensitive confirmation is shown — the
// plaintext credential is never rendered back, per the acceptance
// criteria. Rows that support reverting (OpenRouter, #136) also get a
// clear button wired to an injected onClear action.
import { useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { AuthResult } from '../lib/auth-result.ts'
import { GENERIC_FAILURE } from '../lib/auth-result.ts'
import type { ParsedCredentials } from '../lib/auth-input.ts'

export interface TokenSettingsFormProps {
  label: string
  placeholder: string
  parse: (input: unknown) => ParsedCredentials<{ token: string }>
  savedMessage?: string
  clearedMessage?: string
  submitLabel?: string
  clearLabel?: string
  onSubmit: (data: { token: string }) => Promise<AuthResult>
  onClear?: () => Promise<AuthResult>
}

export function TokenSettingsForm({
  label,
  placeholder,
  parse,
  savedMessage = 'Token saved.',
  clearedMessage = 'Token cleared.',
  submitLabel = 'Save token',
  clearLabel = 'Use shared key',
  onSubmit,
  onClear,
}: TokenSettingsFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'saved' | 'cleared' | null>(null)
  const [pending, setPending] = useState(false)
  // Clearing is a button click, not a submit — the form node is reached
  // through a ref so the input can be reset too.
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // React nulls `currentTarget` once the dispatch finishes — this handler
    // awaits, so the form node must be captured up front for the reset.
    const form = event.currentTarget
    const formData = new FormData(form)

    const parsed = parse({ token: formData.get('token') })
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }

    setError(null)
    setStatus(null)
    setPending(true)
    try {
      // The server-side validator re-runs the same parser, so its thrown
      // rejection is a should-never-happen defense — but a thrown error
      // crossing the wire still lands here as a retryable alert.
      const submitted = await onSubmit(parsed.data)
      if (submitted.ok) {
        form.reset()
        setStatus('saved')
      } else {
        setError(submitted.message)
      }
    } catch {
      setError(GENERIC_FAILURE.message)
    } finally {
      setPending(false)
    }
  }

  async function handleClear() {
    if (!onClear) return
    setError(null)
    setStatus(null)
    setPending(true)
    try {
      const cleared = await onClear()
      if (cleared.ok) {
        formRef.current?.reset()
        setStatus('cleared')
      } else {
        setError(cleared.message)
      }
    } catch {
      setError(GENERIC_FAILURE.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        {label}
        <Input
          name="token"
          type="password"
          autoComplete="off"
          // Screen-reader-friendly hint that matches the label's promise:
          // whatever is pasted here is stored, never shown back.
          placeholder={placeholder}
          className="h-10 rounded-md"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-sm text-primary">
          {status === 'saved' ? savedMessage : clearedMessage}
        </p>
      )}
      <div className="flex flex-row gap-2">
        <Button type="submit" disabled={pending} className="h-10 flex-1 rounded-md">
          {pending ? 'Saving…' : submitLabel}
        </Button>
        {onClear && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-10 rounded-md"
            onClick={() => {
              void handleClear()
            }}
          >
            {clearLabel}
          </Button>
        )}
      </div>
    </form>
  )
}
