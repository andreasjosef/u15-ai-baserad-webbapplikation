// PROTOTYPE SCAFFOLDING. Variant B — "Grouped list": a single Card holding
// a compact overview row per settings area (icon, one-line status), each
// expanding in place on click — the exact accordion interaction
// HistoryView already uses, reused here instead of invented fresh.
// Primary affordance is scanning status at a glance, not always-open forms.
import { useState, type ReactNode } from 'react'
import { ChevronDownIcon, KeyRoundIcon, ListTodoIcon, UserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { TokenSettingsForm } from '../todoist-token-form.tsx'
import type { SettingsVariantProps } from './types.ts'

type RowId = 'todoist' | 'openrouter'

function Row({
  icon: Icon,
  title,
  status,
  connected,
  expanded,
  onToggle,
  children,
}: {
  icon: typeof KeyRoundIcon
  title: string
  status: string
  // Small dot next to the status text: green once this integration is
  // actively using a user-supplied credential, grey otherwise (no token,
  // or — for OpenRouter — falling back to the shared team key). The text
  // already says as much; the dot is a fast, at-a-glance echo of it, not
  // a replacement.
  connected: boolean
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-sm font-medium">{title}</span>
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
        />
        <span className="text-xs text-muted-foreground">{status}</span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {expanded && <div className="px-4 pt-1 pb-4">{children}</div>}
    </div>
  )
}

export function VariantB({
  userName,
  userEmail,
  tokenSaved,
  onSubmitToken,
  openRouterKey,
}: SettingsVariantProps) {
  const [expandedRow, setExpandedRow] = useState<RowId | null>(null)
  const { usingOwnKey, savedKeySuffix, draft, setDraft, status, errorMessage, save, clear } =
    openRouterKey

  function toggle(row: RowId) {
    setExpandedRow((current) => (current === row ? null : row))
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {userName} ({userEmail})
        </p>
      </header>

      <Card className="p-0">
        <Row
          icon={ListTodoIcon}
          title="Todoist"
          status={tokenSaved ? 'Connected' : 'Not connected'}
          connected={tokenSaved}
          expanded={expandedRow === 'todoist'}
          onToggle={() => toggle('todoist')}
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Paste your Todoist personal API token so Hone can create tasks in your account. It is
            stored encrypted and never shown again.
          </p>
          <TokenSettingsForm onSubmit={onSubmitToken} />
        </Row>

        <Row
          icon={KeyRoundIcon}
          title="OpenRouter key"
          status={usingOwnKey ? `Your key …${savedKeySuffix}` : 'Using shared team key'}
          connected={usingOwnKey}
          expanded={expandedRow === 'openrouter'}
          onToggle={() => toggle('openrouter')}
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Hone works out of the box on a shared team key. Paste your own to use your own account
            and quota instead — yours always takes priority when one is saved.
          </p>
          {usingOwnKey ? (
            <Button type="button" variant="outline" size="sm" onClick={clear}>
              Use shared key instead
            </Button>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                save()
              }}
            >
              <Input
                type="password"
                autoComplete="off"
                placeholder="sk-or-…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-9 rounded-md font-mono"
                aria-invalid={status === 'invalid'}
              />
              {status === 'invalid' && errorMessage && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage}
                </p>
              )}
              <Button type="submit" size="sm" disabled={status === 'validating'} className="self-start">
                {status === 'validating' ? 'Validating…' : 'Save key'}
              </Button>
            </form>
          )}
        </Row>
      </Card>

      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <UserIcon className="size-3.5" aria-hidden="true" />
        Profile details currently come from your account — there's nothing to edit here yet.
      </p>
    </main>
  )
}
