// Tests for the nav shell (issue #66). The component is pure —
// navigation and the settings action arrive as injected callbacks, so
// the whole shell renders without a router, db, or network.
//
// jsdom has no CSS breakpoints, so the permanent sidebar and the drawer
// trigger are both always in the DOM. These tests never assert on which
// breakpoint is active — they assert on markup and ARIA state: the
// sidebar nav is scoped by its `aria-label`, the drawer by the `Sheet`'s
// `dialog` role, which Radix only mounts while the drawer is open.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NavShell, type NavItemId } from './nav-shell.tsx'

function renderShell(currentItem?: NavItemId) {
  const onNavigate = vi.fn()
  const onOpenSettings = vi.fn()
  render(
    <NavShell
      currentItem={currentItem}
      onNavigate={onNavigate}
      onOpenSettings={onOpenSettings}
    >
      <main>Screen content</main>
    </NavShell>,
  )
  return { onNavigate, onOpenSettings }
}

function sidebarNav() {
  return within(screen.getByRole('navigation', { name: /main/i }))
}

describe('NavShell', () => {
  it('renders the injected screen content', () => {
    renderShell()
    expect(screen.getByText('Screen content')).toBeInTheDocument()
  })

  it('shows Home and History nav rows and nothing for "my todos"', () => {
    renderShell()
    expect(sidebarNav().getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(sidebarNav().getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /todo/i })).not.toBeInTheDocument()
  })

  it('highlights the row matching currentItem via aria-current', () => {
    renderShell('history')
    expect(sidebarNav().getByRole('button', { name: 'History' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(sidebarNav().getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('highlights no row when currentItem is undefined', () => {
    renderShell()
    expect(sidebarNav().getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
    expect(sidebarNav().getByRole('button', { name: 'History' })).not.toHaveAttribute('aria-current')
  })

  it('fires onNavigate when a sidebar row is clicked', () => {
    const { onNavigate } = renderShell()
    fireEvent.click(sidebarNav().getByRole('button', { name: 'History' }))
    expect(onNavigate).toHaveBeenCalledWith('history')
  })

  it('renders Settings as a top-bar icon outside the nav, firing its handler on click', () => {
    const { onOpenSettings } = renderShell()
    expect(sidebarNav().queryByRole('button', { name: /settings/i })).not.toBeInTheDocument()

    const settings = screen.getByRole('button', { name: /settings/i })
    fireEvent.click(settings)
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('opens the drawer from a labeled trigger and closes it when a drawer row is picked', async () => {
    const { onNavigate } = renderShell()

    const trigger = screen.getByRole('button', { name: /open navigation menu/i })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    const drawer = within(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/hone/i)

    fireEvent.click(drawer.getByRole('button', { name: 'History' }))
    expect(onNavigate).toHaveBeenCalledWith('history')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('highlights the current row inside the drawer too', () => {
    renderShell('history')
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    const drawer = within(screen.getByRole('dialog'))
    expect(drawer.getByRole('button', { name: 'History' })).toHaveAttribute('aria-current', 'page')
  })
})
