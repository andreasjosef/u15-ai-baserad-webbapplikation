// Tests for the extracted Settings view (issue #135, extended by #136).
// Like the Home and History view tests, these render the pure component
// with injected callbacks — no router, db, or network — so the component
// is the testable seam and the route stays thin.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SettingsView } from './settings-view.tsx'

type AuthResult =
  | { ok: true }
  | { ok: false; message: string }

function renderSettingsView({
  tokenSaved = false,
  keySaved = false,
  backLabel = 'Hone',
  onBack = vi.fn(),
  onSubmitToken = vi.fn(async (): Promise<AuthResult> => ({ ok: true })),
  onSubmitOpenRouterKey = vi.fn(async (): Promise<AuthResult> => ({ ok: true })),
  onClearOpenRouterKey = vi.fn(async (): Promise<AuthResult> => ({ ok: true })),
}: {
  tokenSaved?: boolean
  keySaved?: boolean
  backLabel?: string
  onBack?: () => void
  onSubmitToken?: (data: { token: string }) => Promise<AuthResult>
  onSubmitOpenRouterKey?: (data: { token: string }) => Promise<AuthResult>
  onClearOpenRouterKey?: () => Promise<AuthResult>
} = {}) {
  render(
    <SettingsView
      userName="Test User"
      userEmail="person@example.com"
      tokenSaved={tokenSaved}
      keySaved={keySaved}
      backLabel={backLabel}
      onBack={onBack}
      onSubmitToken={onSubmitToken}
      onSubmitOpenRouterKey={onSubmitOpenRouterKey}
      onClearOpenRouterKey={onClearOpenRouterKey}
    />,
  )
  return { onBack, onSubmitToken, onSubmitOpenRouterKey, onClearOpenRouterKey }
}

function todoistRow() {
  return screen.getByRole('button', { name: /todoist/i })
}

function openRouterRow() {
  return screen.getByRole('button', { name: /openrouter/i })
}

function statusDot(row: 'todoist' | 'openrouter') {
  // The dot is deliberately decorative (the status text carries the
  // meaning), so tests reach it via its data-slot — class membership is
  // the only observable in jsdom, same trick as the header-mark test.
  const dot = document.querySelector(`[data-row="${row}"] [data-slot="status-dot"]`)
  expect(dot).not.toBeNull()
  return dot as HTMLElement
}

describe('SettingsView', () => {
  it('renders the heading and the signed-in line', () => {
    renderSettingsView()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Account settings' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Signed in as Test User/)).toBeInTheDocument()
    expect(screen.getByText(/person@example.com/)).toBeInTheDocument()
  })

  it('keeps both forms collapsed until their rows are expanded', () => {
    renderSettingsView()

    expect(screen.queryByLabelText('Todoist API token')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('OpenRouter API key')).not.toBeInTheDocument()

    fireEvent.click(todoistRow())

    expect(todoistRow()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Todoist API token')).toBeInTheDocument()
    expect(screen.queryByLabelText('OpenRouter API key')).not.toBeInTheDocument()

    fireEvent.click(openRouterRow())

    expect(openRouterRow()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('OpenRouter API key')).toBeInTheDocument()
  })

  it('expands only one row at a time', () => {
    renderSettingsView()

    fireEvent.click(todoistRow())
    expect(screen.getByLabelText('Todoist API token')).toBeInTheDocument()

    fireEvent.click(openRouterRow())
    expect(openRouterRow()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('OpenRouter API key')).toBeInTheDocument()
    expect(todoistRow()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Todoist API token')).not.toBeInTheDocument()
  })

  it('collapses the row again on a second click', () => {
    renderSettingsView()

    fireEvent.click(todoistRow())
    expect(screen.getByLabelText('Todoist API token')).toBeInTheDocument()

    fireEvent.click(todoistRow())
    expect(todoistRow()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Todoist API token')).not.toBeInTheDocument()
  })

  it('shows a green status dot and Connected text when a token is saved', () => {
    renderSettingsView({ tokenSaved: true })

    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(statusDot('todoist')).toHaveClass('bg-emerald-500')
    expect(statusDot('todoist')).not.toHaveClass('bg-muted-foreground/40')
  })

  it('shows a grey status dot and Not connected text when no token is saved', () => {
    renderSettingsView({ tokenSaved: false })

    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(statusDot('todoist')).toHaveClass('bg-muted-foreground/40')
    expect(statusDot('todoist')).not.toHaveClass('bg-emerald-500')
  })

  it('shows "Using your own key" and a green dot on the OpenRouter row when a key is saved', () => {
    renderSettingsView({ keySaved: true })

    expect(screen.getByText('Using your own key')).toBeInTheDocument()
    expect(statusDot('openrouter')).toHaveClass('bg-emerald-500')
    expect(statusDot('openrouter')).not.toHaveClass('bg-muted-foreground/40')
  })

  it('shows "Using shared key" and a grey dot on the OpenRouter row when no key is saved', () => {
    renderSettingsView({ keySaved: false })

    expect(screen.getByText('Using shared key')).toBeInTheDocument()
    expect(statusDot('openrouter')).toHaveClass('bg-muted-foreground/40')
    expect(statusDot('openrouter')).not.toHaveClass('bg-emerald-500')
  })

  it('keeps the two rows’ status dots independent', () => {
    renderSettingsView({ tokenSaved: false, keySaved: true })

    expect(statusDot('todoist')).toHaveClass('bg-muted-foreground/40')
    expect(statusDot('openrouter')).toHaveClass('bg-emerald-500')
  })

  it('submits the pasted token through the injected callback', async () => {
    const { onSubmitToken } = renderSettingsView()

    fireEvent.click(todoistRow())
    fireEvent.input(screen.getByLabelText('Todoist API token'), {
      target: { value: 'a1b2c3d4e5f6' },
    })
    fireEvent.submit(
      (screen.getByRole('button', { name: 'Save token' }) as HTMLButtonElement)
        .form!,
    )

    await vi.waitFor(() =>
      expect(onSubmitToken).toHaveBeenCalledWith({ token: 'a1b2c3d4e5f6' }),
    )
  })

  it('submits the pasted OpenRouter key through the injected callback', async () => {
    const { onSubmitOpenRouterKey } = renderSettingsView()

    fireEvent.click(openRouterRow())
    fireEvent.input(screen.getByLabelText('OpenRouter API key'), {
      target: { value: 'sk-or-v1-abc123' },
    })
    fireEvent.submit(
      (screen.getByRole('button', { name: 'Save key' }) as HTMLButtonElement)
        .form!,
    )

    await vi.waitFor(() =>
      expect(onSubmitOpenRouterKey).toHaveBeenCalledWith({ token: 'sk-or-v1-abc123' }),
    )
  })

  it('reverts to the shared key through the injected clear callback', async () => {
    const { onClearOpenRouterKey } = renderSettingsView({ keySaved: true })

    fireEvent.click(openRouterRow())
    fireEvent.click(screen.getByRole('button', { name: 'Use shared key' }))

    await vi.waitFor(() => expect(onClearOpenRouterKey).toHaveBeenCalledTimes(1))
  })

  it('never toggles a row when a click lands inside its expanded form', () => {
    renderSettingsView({ keySaved: true })

    fireEvent.click(openRouterRow())
    expect(openRouterRow()).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByLabelText('OpenRouter API key'))
    fireEvent.click(screen.getByRole('button', { name: 'Use shared key' }))
    expect(openRouterRow()).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders the back link labelled with its target and calls onBack', () => {
    const onBack = vi.fn()
    renderSettingsView({ backLabel: 'History', onBack })

    fireEvent.click(screen.getByRole('button', { name: 'Back to History' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('defaults the back link label to Home', () => {
    renderSettingsView({ backLabel: 'Hone' })

    expect(
      screen.getByRole('button', { name: 'Back to Hone' }),
    ).toBeInTheDocument()
  })
})
