// PROTOTYPE SCAFFOLDING. Variant C — "Two-pane sub-nav": a mini vertical
// nav (styled like NavShell's own NavRow) on the left picks one section;
// the right pane shows only that section, full width, no scrolling
// accordion. The most structurally different of the three — a
// navigation-driven single-section view instead of a scannable list.
import { useState } from 'react'
import { CircleCheckIcon, KeyRoundIcon, ListTodoIcon, UserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { TokenSettingsForm } from '../todoist-token-form.tsx'
import type { SettingsVariantProps } from './types.ts'

type SectionId = 'profile' | 'todoist' | 'openrouter'

const SECTIONS: ReadonlyArray<{ id: SectionId; label: string; icon: typeof UserIcon }> = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'todoist', label: 'Todoist', icon: ListTodoIcon },
  { id: 'openrouter', label: 'OpenRouter key', icon: KeyRoundIcon },
]

export function VariantC({
  userName,
  userEmail,
  tokenSaved,
  onSubmitToken,
  openRouterKey,
}: SettingsVariantProps) {
  const [section, setSection] = useState<SectionId>('profile')
  const { usingOwnKey, savedKeySuffix, draft, setDraft, status, errorMessage, save, clear } =
    openRouterKey

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>

      <div className="flex flex-col gap-6 sm:flex-row">
        <nav aria-label="Settings sections" className="flex shrink-0 flex-row gap-1 sm:w-48 sm:flex-col">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                section === id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 rounded-xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10">
          {section === 'profile' && (
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base font-medium">Profile</h2>
              <p className="text-sm text-muted-foreground">
                Signed in as {userName} ({userEmail})
              </p>
            </div>
          )}

          {section === 'todoist' && (
            <div className="flex max-w-sm flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-base font-medium">Todoist</h2>
                <p className="text-sm text-muted-foreground">
                  Paste your Todoist personal API token so Hone can create tasks in your account.
                  It is stored encrypted and never shown again —{' '}
                  {tokenSaved ? 'a token is already saved.' : 'no token is saved yet.'}
                </p>
              </div>
              <TokenSettingsForm onSubmit={onSubmitToken} />
            </div>
          )}

          {section === 'openrouter' && (
            <div className="flex max-w-sm flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-base font-medium">OpenRouter key</h2>
                <p className="text-sm text-muted-foreground">
                  Hone works out of the box on a shared team key. Paste your own to use your own
                  account and quota instead — yours always takes priority when one is saved.
                </p>
              </div>

              {usingOwnKey ? (
                <div className="flex flex-col items-start gap-3 rounded-lg bg-muted px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <CircleCheckIcon className="size-4 text-primary" aria-hidden="true" />
                    <span>
                      Using your key{' '}
                      <span className="font-mono text-muted-foreground">sk-or-…{savedKeySuffix}</span>
                    </span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={clear}>
                    Use shared key instead
                  </Button>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    save()
                  }}
                >
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    OpenRouter API key
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder="sk-or-…"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="h-10 rounded-md font-mono"
                      aria-invalid={status === 'invalid'}
                    />
                  </label>
                  {status === 'invalid' && errorMessage && (
                    <p role="alert" className="text-sm text-destructive">
                      {errorMessage}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={status === 'validating'}
                    className="h-10 w-full rounded-md"
                  >
                    {status === 'validating' ? 'Validating…' : 'Save key'}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
