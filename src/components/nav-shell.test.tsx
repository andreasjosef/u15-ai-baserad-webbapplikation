// Tests for the nav shell (issue #66). The component is pure —
// navigation and the settings action arrive as injected callbacks, so
// the whole shell renders without a router, db, or network.
//
// jsdom has no CSS breakpoints, so the permanent sidebar and the drawer
// trigger are both always in the DOM. These tests never assert on which
// breakpoint is active — they assert on markup and ARIA state: the
// sidebar is scoped by its `complementary` landmark (`<aside>`), the
// drawer by the `Sheet`'s `dialog` role, which Radix only mounts while
// the drawer is open.
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

function sidebar() {
  return within(screen.getByRole('complementary'))
}

function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
  return within(screen.getByRole('dialog'))
}

describe('NavShell', () => {
  // Issue #86: the shell is height-bound (`h-dvh`, not `min-h-screen`)
  // so the whole page never grows — the content wrapper is what scrolls,
  // keeping the sidebar and top bar pinned. Asserted via the container
  // classes, since jsdom does no layout.
  it('is height-bound: fixed shell with an internally scrolling content wrapper', () => {
    renderShell()
    const content = screen.getByText('Screen content')

    const shell = content.closest('.h-dvh')
    expect(shell).not.toBeNull()
    expect(shell).toHaveClass('overflow-hidden')
    expect(shell).not.toHaveClass('min-h-screen')

    const wrapper = content.closest('.overflow-y-auto')
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveClass('min-h-0', 'flex-1')
  })

  it('renders the injected screen content', () => {
    renderShell()
    expect(screen.getByText('Screen content')).toBeInTheDocument()
  })

  it('shows Home and History nav rows and nothing for "my todos"', () => {
    renderShell()
    expect(sidebar().getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(sidebar().getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /todo/i })).not.toBeInTheDocument()
  })

  it('highlights the row matching currentItem via aria-current', () => {
    renderShell('history')
    expect(sidebar().getByRole('button', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(sidebar().getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('highlights no row when currentItem is undefined', () => {
    renderShell()
    expect(sidebar().getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
    expect(sidebar().getByRole('button', { name: 'History' })).not.toHaveAttribute('aria-current')
  })

  it('fires onNavigate when a sidebar row is clicked', () => {
    const { onNavigate } = renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'History' }))
    expect(onNavigate).toHaveBeenCalledWith('history')
  })

  it('fires onOpenSettings from the top-bar Settings icon', () => {
    const { onOpenSettings } = renderShell()
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('keeps Settings out of both the sidebar and the drawer navs', () => {
    renderShell()
    expect(sidebar().queryByRole('button', { name: /settings/i })).not.toBeInTheDocument()
    expect(openDrawer().queryByRole('button', { name: /settings/i })).not.toBeInTheDocument()
  })

  it('shows the theme toggle in the top bar beside Settings (issue #83)', () => {
    renderShell()
    expect(screen.getByRole('switch')).toBeInTheDocument()
    expect(sidebar().queryByRole('switch')).not.toBeInTheDocument()
  })

  it('opens the drawer from a labeled trigger and closes it when a drawer row is picked', async () => {
    const { onNavigate } = renderShell()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const drawer = openDrawer()
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/hone/i)

    fireEvent.click(drawer.getByRole('button', { name: 'History' }))
    expect(onNavigate).toHaveBeenCalledWith('history')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes the drawer on Escape without navigating', async () => {
    const { onNavigate } = renderShell()
    openDrawer()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('highlights the current row inside the drawer too', () => {
    renderShell('history')
    expect(openDrawer().getByRole('button', { name: 'History' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
