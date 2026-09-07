import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './index'

const user = { name: 'Test User', email: 'person@example.com' }

function renderHomePage(onLogOut = async () => ({ ok: true }) as const) {
  const onOpenSettings = vi.fn()
  const onStartInterview = vi.fn()
  render(
    <HomePage
      user={user}
      onLogOut={onLogOut}
      onOpenSettings={onOpenSettings}
      onStartInterview={onStartInterview}
    />,
  )
  return { onOpenSettings, onStartInterview }
}

describe('HomePage', () => {
  it('renders the app name as a heading', () => {
    renderHomePage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hone' }),
    ).toBeInTheDocument()
  })

  it('offers a way to start an interview', () => {
    const { onStartInterview } = renderHomePage()

    fireEvent.click(screen.getByRole('button', { name: 'Start an interview' }))
    expect(onStartInterview).toHaveBeenCalledTimes(1)
  })

  it('offers a way to open account settings', () => {
    const { onOpenSettings } = renderHomePage()

    fireEvent.click(screen.getByRole('button', { name: 'Account settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('shows who is signed in and offers a log out action', async () => {
    const onLogOut = vi.fn(async () => ({ ok: true }) as const)
    render(<HomePage user={user} onLogOut={onLogOut} onOpenSettings={() => {}} onStartInterview={() => {}} />)

    expect(screen.getByText(/Signed in as Test User/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await vi.waitFor(() => expect(onLogOut).toHaveBeenCalledTimes(1))
  })

  it('shows a retryable alert when log out fails instead of navigating silently', async () => {
    const onLogOut = vi.fn(async () => ({
      ok: false,
      message: 'Something went wrong. Please try again.',
    }) as const)
    render(<HomePage user={user} onLogOut={onLogOut} onOpenSettings={() => {}} onStartInterview={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    )
  })
})
