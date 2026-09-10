// PROTOTYPE SCAFFOLDING for issue #44 (bring-your-own OpenRouter key).
// Storage and the real validate-against-OpenRouter call are explicitly
// out of scope for this prototype — the open question is the paste/
// validate/clear *UI*, not ADR-0002's encryption pattern. So this hook
// fakes the round trip in memory: any key must be typed again after a
// refresh, and "Save my own key" is undone by "Use the shared key" with
// no confirmation step (a real implementation would likely want one).
//
// A pasted key beginning with `sk-or-` "validates"; anything else fails,
// so both paths are reachable while trying the three variants. Shared by
// all three settings-page variants — the prototype question is how this
// state is *presented*, not what the state is.
import { useState } from 'react'

export type OpenRouterKeyStatus = 'idle' | 'validating' | 'invalid'

export interface OpenRouterKeyStub {
  // Whether the account currently has its own key saved, vs. relying on
  // the shared team key (the additive default from the wayfinder map).
  usingOwnKey: boolean
  // Last 4 characters of the saved key, for the "…abcd" display — the
  // full value is never kept once "saved".
  savedKeySuffix: string | null
  draft: string
  setDraft: (value: string) => void
  status: OpenRouterKeyStatus
  errorMessage: string | null
  save: () => void
  clear: () => void
}

const VALIDATION_DELAY_MS = 600

export function useOpenRouterKeyStub(): OpenRouterKeyStub {
  const [usingOwnKey, setUsingOwnKey] = useState(false)
  const [savedKeySuffix, setSavedKeySuffix] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<OpenRouterKeyStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function save() {
    const trimmed = draft.trim()
    if (trimmed.length === 0) {
      setStatus('invalid')
      setErrorMessage('Paste your OpenRouter API key.')
      return
    }
    setStatus('validating')
    setErrorMessage(null)
    // Stand-in for an OpenRouter validation call — see the file header.
    setTimeout(() => {
      if (trimmed.startsWith('sk-or-')) {
        setUsingOwnKey(true)
        setSavedKeySuffix(trimmed.slice(-4))
        setDraft('')
        setStatus('idle')
      } else {
        setStatus('invalid')
        setErrorMessage("That doesn't look like a valid OpenRouter key — it should start with sk-or-.")
      }
    }, VALIDATION_DELAY_MS)
  }

  function clear() {
    setUsingOwnKey(false)
    setSavedKeySuffix(null)
    setDraft('')
    setStatus('idle')
    setErrorMessage(null)
  }

  return { usingOwnKey, savedKeySuffix, draft, setDraft, status, errorMessage, save, clear }
}
