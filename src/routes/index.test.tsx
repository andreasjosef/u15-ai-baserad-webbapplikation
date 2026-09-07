import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './index'

describe('HomePage', () => {
  it('renders the app name as a heading', () => {
    render(
      <HomePage user={{ name: 'Test User', email: 'person@example.com' }} onLogOut={async () => {}} />,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hone' }),
    ).toBeInTheDocument()
  })

  it('shows who is signed in and offers a log out action', async () => {
    const onLogOut = vi.fn(async () => {})
    render(
      <HomePage user={{ name: 'Test User', email: 'person@example.com' }} onLogOut={onLogOut} />,
    )

    expect(screen.getByText(/Signed in as Test User/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await vi.waitFor(() => expect(onLogOut).toHaveBeenCalledTimes(1))
  })
})
