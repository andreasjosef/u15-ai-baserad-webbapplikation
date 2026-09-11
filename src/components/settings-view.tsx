// The Settings view (issue #135, extended by #136): pure and
// presentational, mirroring the Home/History split — the route injects
// the save/clear actions and the back-navigation, so this renders without
// a router, db, or network.
//
// One Card holds a compact overview row per settings area; clicking a row
// expands it in place — the exact accordion interaction HistoryView
// already uses, reused here instead of invented fresh. The row shows a
// small status dot: green once the row's credential is saved, grey
// otherwise — a fast at-a-glance echo of the status text, not a
// replacement. For OpenRouter (#136) "saved" means a personal key is
// stored; otherwise Interviews run on the shared default key.
//
// The back-link target arrives as a label (`backLabel`) plus an injected
// `onBack` callback: the route decides where "back" goes (the actual
// referrer, via router history), and the label names it — "Back to Hone"
// from Home, "Back to History" from the History screen, and so on.
import { useState, type MouseEvent, type ReactNode } from 'react'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  KeyRoundIcon,
  ListTodoIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import type { AuthResult } from '../lib/auth-result.ts'
import { parseTodoistToken } from '../lib/token-input.ts'
import { OpenRouterKeyForm } from './openrouter-key-form.tsx'
import { TokenSettingsForm } from './todoist-token-form.tsx'

export interface SettingsViewProps {
  userName: string
  userEmail: string
  tokenSaved: boolean
  keySaved: boolean
  backLabel: string
  onBack: () => void
  onSubmitToken: (data: { token: string }) => Promise<AuthResult>
  onSubmitOpenRouterKey: (data: { token: string }) => Promise<AuthResult>
  onClearOpenRouterKey: () => Promise<AuthResult>
}

// One expanded row at a time — the accordion id, null when collapsed.
// Same shape as HistoryView's expandedId.
type SettingsRowId = 'todoist' | 'openrouter'

const ROW_IDS: SettingsRowId[] = ['todoist', 'openrouter']

function SettingsRow({
  rowId,
  icon,
  title,
  status,
  connected,
  expanded,
  children,
}: {
  rowId: SettingsRowId
  icon: ReactNode
  title: string
  status: string
  connected: boolean
  expanded: boolean
  children: ReactNode
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      {/* No onClick here: the Card is the single click target (as the row
          is in HistoryView), so a header click can never toggle twice.
          data-row is how the Card's click handler knows which row was
          hit — and how tests scope assertions to one row's dot. */}
      <button
        type="button"
        data-row={rowId}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
      >
        <span className="shrink-0 text-muted-foreground [&_svg]:size-4" aria-hidden="true">
          {icon}
        </span>
        <span className="flex-1 text-sm font-medium">{title}</span>
        <span
          data-slot="status-dot"
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

export function SettingsView({
  userName,
  userEmail,
  tokenSaved,
  keySaved,
  backLabel,
  onBack,
  onSubmitToken,
  onSubmitOpenRouterKey,
  onClearOpenRouterKey,
}: SettingsViewProps) {
  const [expandedRow, setExpandedRow] = useState<SettingsRowId | null>(null)

  function toggle(row: SettingsRowId) {
    setExpandedRow((current) => (current === row ? null : row))
  }

  // The whole Card is one click target (the rows fully fill it). The
  // clicked row is found via its data-row marker; clicks inside an
  // expanded form (input, Save/Use-shared-key buttons) never toggle —
  // same guard as HistoryView's handleRowClick.
  function handleCardClick(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (target.closest('[data-detail]') !== null) return
    const row = target.closest<HTMLElement>('[data-row]')
    if (row === null) return
    const rowId = row.dataset.row as SettingsRowId
    if (!ROW_IDS.includes(rowId)) return
    toggle(rowId)
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {userName} ({userEmail})
        </p>
      </header>

      <Card className="p-0" onClick={handleCardClick}>
        <SettingsRow
          rowId="todoist"
          icon={<ListTodoIcon />}
          title="Todoist"
          status={tokenSaved ? 'Connected' : 'Not connected'}
          connected={tokenSaved}
          expanded={expandedRow === 'todoist'}
        >
          <div data-detail className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Paste your Todoist personal API token so Hone can create tasks
              in your account. It is stored encrypted and never shown again.
            </p>
            <TokenSettingsForm
              label="Todoist API token"
              placeholder="Paste your Todoist personal API token"
              parse={parseTodoistToken}
              onSubmit={onSubmitToken}
            />
          </div>
        </SettingsRow>

        <SettingsRow
          rowId="openrouter"
          icon={<KeyRoundIcon />}
          title="OpenRouter"
          status={keySaved ? 'Using your own key' : 'Using shared key'}
          connected={keySaved}
          expanded={expandedRow === 'openrouter'}
        >
          <div data-detail className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Paste your own OpenRouter API key so Interviews run on your
              account instead of the shared one. It is stored encrypted and
              never shown again; clearing it reverts to the shared key.
            </p>
            <OpenRouterKeyForm
              onSubmit={onSubmitOpenRouterKey}
              onClear={onClearOpenRouterKey}
            />
          </div>
        </SettingsRow>
      </Card>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
        onClick={onBack}
      >
        <ChevronLeftIcon aria-hidden="true" />
        Back to {backLabel}
      </Button>
    </main>
  )
}
