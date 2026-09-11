// The OpenRouter key-entry form for the settings page's OpenRouter row
// (issue #136): TokenSettingsForm configured with the key's labels and the
// OpenRouter parser, plus the clear action that reverts the account to the
// shared OPENROUTER_API_KEY default. The Todoist row (issue #23) renders
// TokenSettingsForm directly; this wrapper exists so each settings row
// keeps a named component the view and its tests can attach to.
import type { AuthResult } from '../lib/auth-result.ts'
import { parseOpenRouterKey } from '../lib/token-input.ts'

import { TokenSettingsForm } from './todoist-token-form.tsx'

export interface OpenRouterKeyFormProps {
  onSubmit: (data: { token: string }) => Promise<AuthResult>
  onClear: () => Promise<AuthResult>
}

export function OpenRouterKeyForm({ onSubmit, onClear }: OpenRouterKeyFormProps) {
  return (
    <TokenSettingsForm
      label="OpenRouter API key"
      placeholder="Paste your OpenRouter API key"
      parse={parseOpenRouterKey}
      savedMessage="Key saved."
      clearedMessage="Key cleared."
      submitLabel="Save key"
      clearLabel="Use shared key"
      onSubmit={onSubmit}
      onClear={onClear}
    />
  )
}
