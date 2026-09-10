// Tests for the extracted Settings view (issue #135). Like the Home and
// History view tests, these render the pure component with injected
// callbacks — no router, db, or network — so the component is the
// testable seam and the route stays thin.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SettingsView } from './settings-view.tsx'

function renderSettingsView({
  tokenSaved = false,
  backLabel = 'Hone',
  onBack = vi.fn(),
  onSubmitToken = vi.fn(async () => ({ ok: true }) as const),
}: {
  tokenSaved?: boolean
  backLabel?: string
  onBack?: () => void
  onSubmitToken?: (data: { token: string }) => Promise<{ ok: true } | { ok: false; message: string }>
} = {}) {
  render(
    <SettingsView
      userName="Test User"
      userEmail="person@example.com"
      tokenSaved={tokenSaved}
      backLabel={backLabel}
      onBack={onBack}
      onSubmitToken={onSubmitToken}
    />,
  )
  return { onBack, onSubmitToken }
}

function todoistRow() {
  return screen.getByRole('button', { name: /todoist/i })
}

function statusDot() {
  // The dot is deliberately decorative (the status text carries the
  // meaning), so tests reach it via its data-slot — class membership is
  // the only observable in jsdom, same trick as the header-mark test.
  const dot = document.querySelector('[data-slot="status-dot"]')
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

  it('keeps the token form collapsed until the Todoist row is expanded', () => {
    renderSettingsView()

    expect(
      screen.queryByLabelText('Todoist API token'),
    ).not.toBeInTheDocument()

    fireEvent.click(todoistRow())

    expect(todoistRow()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Todoist API token')).toBeInTheDocument()
  })

  it('collapses the row again on a second click', () => {
    renderSettingsView()

    fireEvent.click(todoistRow())
    expect(screen.getByLabelText('Todoist API token')).toBeInTheDocument()

    fireEvent.click(todoistRow())
    expect(todoistRow()).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByLabelText('Todoist API token'),
    ).not.toBeInTheDocument()
  })

  it('shows a green status dot and Connected text when a token is saved', () => {
    renderSettingsView({ tokenSaved: true })

    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(statusDot()).toHaveClass('bg-emerald-500')
    expect(statusDot()).not.toHaveClass('bg-muted-foreground/40')
  })

  it('shows a grey status dot and Not connected text when no token is saved', () => {
    renderSettingsView({ tokenSaved: false })

    expect(screen.getByText('Not connected')).toBeInTheDocument()
    expect(statusDot()).toHaveClass('bg-muted-foreground/40')
    expect(statusDot()).not.toHaveClass('bg-emerald-500')
  })

  it('submits the pasted token through the injected callback', async () => {
    const onSubmitToken = vi.fn(async () => ({ ok: true }) as const)
    renderSettingsView({ onSubmitToken })

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
