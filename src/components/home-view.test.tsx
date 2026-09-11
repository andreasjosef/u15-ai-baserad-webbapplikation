import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HomePage } from './home-view.tsx'
import type { AuthResult } from '../lib/auth-result.ts'

const user = { name: 'Test User', email: 'person@example.com' }

function renderHomePage(
  onLogOut: () => Promise<AuthResult> = async () => ({ ok: true }),
) {
  const onLogIn = vi.fn()
  const onSignUp = vi.fn()
  const onOpenSettings = vi.fn()
  const onStartInterview = vi.fn()
  const onOpenHistory = vi.fn()
  render(
    <HomePage
      user={user}
      onLogIn={onLogIn}
      onSignUp={onSignUp}
      onLogOut={onLogOut}
      onOpenHistory={onOpenHistory}
      onOpenSettings={onOpenSettings}
      onStartInterview={onStartInterview}
    />,
  )
  return { onLogIn, onSignUp, onOpenSettings, onStartInterview, onOpenHistory }
}

function renderLoggedOutHomePage() {
  const onLogIn = vi.fn()
  const onSignUp = vi.fn()
  render(
    <HomePage
      user={null}
      onLogIn={onLogIn}
      onSignUp={onSignUp}
      onLogOut={async () => ({ ok: true }) as const}
      onOpenHistory={() => {}}
      onOpenSettings={() => {}}
      onStartInterview={() => {}}
    />,
  )
  return { onLogIn, onSignUp }
}

describe('HomePage (logged in)', () => {
  it('renders the app name as a heading', () => {
    renderHomePage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hone' }),
    ).toBeInTheDocument()
  })

  // Issue #104: the header pairs the logo mark with the "Hone" heading.
  // The mark is decorative — the heading carries the accessible name —
  // so it must not change the heading's name.
  it('pairs the header heading with the logo mark', () => {
    renderHomePage()

    const heading = screen.getByRole('heading', { level: 1, name: 'Hone' })
    const mark = heading.previousElementSibling
    expect(mark).not.toBeNull()
    expect(mark?.tagName.toLowerCase()).toBe('svg')
    expect(mark).toHaveAttribute('aria-hidden', 'true')
  })

  // Issue #134: the header mark grows one size tier (size-5 → size-6) —
  // class membership is the only observable, jsdom having no layout.
  it('renders the header logo mark at the larger size tier', () => {
    renderHomePage()

    const heading = screen.getByRole('heading', { level: 1, name: 'Hone' })
    const mark = heading.previousElementSibling
    expect(mark).toHaveClass('size-6')
    expect(mark).not.toHaveClass('size-5')
  })

  it('offers a way to start an interview', () => {
    const { onStartInterview } = renderHomePage()

    fireEvent.click(screen.getByRole('button', { name: 'Start an interview' }))
    expect(onStartInterview).toHaveBeenCalledTimes(1)
  })

  it('offers a way to open the history view', () => {
    const { onOpenHistory } = renderHomePage()

    fireEvent.click(screen.getByRole('button', { name: 'View history' }))
    expect(onOpenHistory).toHaveBeenCalledTimes(1)
  })

  it('shows the three how-it-works steps', () => {
    renderHomePage()

    expect(screen.getByText('Answer a few questions')).toBeInTheDocument()
    expect(screen.getByText('Get a concrete plan')).toBeInTheDocument()
    expect(screen.getByText('Sync it to Todoist')).toBeInTheDocument()
  })

  it('offers a way to open account settings', () => {
    const { onOpenSettings } = renderHomePage()

    fireEvent.click(screen.getByRole('button', { name: 'Account settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('shows who is signed in and offers a log out action', async () => {
    const onLogOut = vi.fn(async () => ({ ok: true }) as const)
    renderHomePage(onLogOut)

    expect(screen.getByText(/Signed in as Test User/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await vi.waitFor(() => expect(onLogOut).toHaveBeenCalledTimes(1))
  })

  it('shows a retryable alert when log out fails instead of navigating silently', async () => {
    const onLogOut = vi.fn(async () => ({
      ok: false,
      message: 'Something went wrong. Please try again.',
    }) as const)
    renderHomePage(onLogOut)

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })
})

// Issue #133: `/` no longer redirects anonymous visitors to /login — the
// same component renders a marketing view instead, driven by a null user.
describe('HomePage (logged out)', () => {
  it('still renders the app name and the how-it-works steps', () => {
    renderLoggedOutHomePage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Hone' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Answer a few questions')).toBeInTheDocument()
    expect(screen.getByText('Get a concrete plan')).toBeInTheDocument()
    expect(screen.getByText('Sync it to Todoist')).toBeInTheDocument()
  })

  it('offers sign-up and log-in CTAs from the header', () => {
    const { onLogIn, onSignUp } = renderLoggedOutHomePage()

    const header = within(screen.getByRole('banner'))
    fireEvent.click(header.getByRole('button', { name: 'Sign up' }))
    expect(onSignUp).toHaveBeenCalledTimes(1)

    fireEvent.click(header.getByRole('button', { name: 'Log in' }))
    expect(onLogIn).toHaveBeenCalledTimes(1)
  })

  it('offers sign-up and log-in CTAs from the hero', () => {
    const { onLogIn, onSignUp } = renderLoggedOutHomePage()

    const main = within(screen.getByRole('main'))
    fireEvent.click(main.getByRole('button', { name: 'Sign up' }))
    expect(onSignUp).toHaveBeenCalledTimes(1)

    fireEvent.click(main.getByRole('button', { name: 'Log in' }))
    expect(onLogIn).toHaveBeenCalledTimes(1)
  })

  it('shows neither the signed-in line nor the authenticated actions', () => {
    renderLoggedOutHomePage()

    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Log out' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Account settings' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start an interview' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'View history' }),
    ).not.toBeInTheDocument()
  })
})
