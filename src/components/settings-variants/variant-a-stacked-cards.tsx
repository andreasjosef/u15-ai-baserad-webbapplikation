// PROTOTYPE SCAFFOLDING. Variant A — "Stacked cards": everything visible
// at once, one Card per settings area, in the same single-column
// max-w-2xl layout History and the Task Breakdown review already use.
// The safe, closest-to-current-app option — the least risky change, and
// a baseline the other two variants are judged against.
import { CircleCheckIcon, KeyRoundIcon, ListTodoIcon, UserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { TokenSettingsForm } from '../todoist-token-form.tsx'
import type { SettingsVariantProps } from './types.ts'

export function VariantA({
  userName,
  userEmail,
  tokenSaved,
  onSubmitToken,
  openRouterKey,
}: SettingsVariantProps) {
  const { usingOwnKey, savedKeySuffix, draft, setDraft, status, errorMessage, save, clear } =
    openRouterKey

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and connected accounts.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Signed in as {userName}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{userEmail}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListTodoIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Todoist</CardTitle>
          </div>
          <CardDescription>
            Paste your Todoist personal API token so Hone can create tasks in your account. It is
            stored encrypted and never shown again —{' '}
            {tokenSaved ? 'a token is already saved.' : 'no token is saved yet.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TokenSettingsForm onSubmit={onSubmitToken} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle>OpenRouter key</CardTitle>
          </div>
          <CardDescription>
            Hone works out of the box on a shared team key. Paste your own OpenRouter key to use
            your own account and quota instead — yours always takes priority when one is saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usingOwnKey ? (
            <div className="flex items-center justify-between gap-4 rounded-lg bg-muted px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <CircleCheckIcon className="size-4 text-primary" aria-hidden="true" />
                <span>
                  Using your key <span className="font-mono text-muted-foreground">sk-or-…{savedKeySuffix}</span>
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
              <Button type="submit" disabled={status === 'validating'} className="h-10 w-full rounded-md">
                {status === 'validating' ? 'Validating…' : 'Save key'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
