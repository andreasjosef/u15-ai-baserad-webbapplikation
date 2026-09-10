// PROTOTYPE SCAFFOLDING — shared prop shape for the three /settings
// variants (issue #44 + the general old-styles cleanup). See
// src/routes/settings.tsx for how these are wired up.
import type { AuthResult } from '../../lib/auth-result.ts'
import type { OpenRouterKeyStub } from './use-openrouter-key-stub.ts'

export interface SettingsVariantProps {
  userName: string
  userEmail: string
  tokenSaved: boolean
  onSubmitToken: (data: { token: string }) => Promise<AuthResult>
  openRouterKey: OpenRouterKeyStub
}
