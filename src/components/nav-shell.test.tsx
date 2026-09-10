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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SIDEBAR_STORAGE_KEY } from '../lib/sidebar.ts'
import { NavShell, type NavItemId } from './nav-shell.tsx'

function renderShell(currentItem?: NavItemId) {
  const onNavigate = vi.fn()
  const onNavigateHome = vi.fn()
  const onOpenSettings = vi.fn()
  render(
    <NavShell
      currentItem={currentItem}
      onNavigate={onNavigate}
      onNavigateHome={onNavigateHome}
      onOpenSettings={onOpenSettings}
    >
      <main>Screen content</main>
    </NavShell>,
  )
  return { onNavigate, onNavigateHome, onOpenSettings }
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

  it('shows Interview and History nav rows and nothing for "my todos"', () => {
    renderShell()
    expect(sidebar().getByRole('button', { name: 'Interview' })).toBeInTheDocument()
    expect(sidebar().getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /todo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument()
  })

  it('highlights the row matching currentItem via aria-current', () => {
    renderShell('history')
    expect(sidebar().getByRole('button', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(sidebar().getByRole('button', { name: 'Interview' })).not.toHaveAttribute('aria-current')
  })

  it('highlights the Interview row when it is the current item (issue #100)', () => {
    renderShell('interview')
    expect(sidebar().getByRole('button', { name: 'Interview' })).toHaveAttribute('aria-current', 'page')
    expect(sidebar().getByRole('button', { name: 'History' })).not.toHaveAttribute('aria-current')
  })

  it('highlights no row when currentItem is undefined', () => {
    renderShell()
    expect(sidebar().getByRole('button', { name: 'Interview' })).not.toHaveAttribute('aria-current')
    expect(sidebar().getByRole('button', { name: 'History' })).not.toHaveAttribute('aria-current')
  })

  it('fires onNavigate when the Interview sidebar row is clicked', () => {
    const { onNavigate } = renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Interview' }))
    expect(onNavigate).toHaveBeenCalledWith('interview')
  })

  it('fires onNavigate when a sidebar row is clicked', () => {
    const { onNavigate } = renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'History' }))
    expect(onNavigate).toHaveBeenCalledWith('history')
  })

  // Issue #100: the wordmark is the Home link — a real link (`role="link"`,
  // `href="/"`) in all three places it renders, with plain clicks handed to
  // the injected callback so the SPA navigates client-side. Since #102 the
  // sidebar wordmark also carries a CSS-gated "H" mark for the collapsed
  // rail, so the accessible name is the two marks concatenated in jsdom
  // (which applies no CSS) — matched with a regex.
  it('renders the wordmark as a Home link in the sidebar and the mobile top bar', () => {
    renderShell()
    expect(sidebar().getByRole('link', { name: /hone/i })).toHaveAttribute('href', '/')
    expect(within(screen.getByRole('banner')).getByRole('link', { name: /hone/i })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('navigates home when a wordmark link is clicked', () => {
    const { onNavigateHome, onNavigate } = renderShell()
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: /hone/i }))
    expect(onNavigateHome).toHaveBeenCalledTimes(1)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('navigates home from the drawer wordmark too, closing the drawer', async () => {
    const { onNavigateHome } = renderShell()
    openDrawer()

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: /hone/i }))
    expect(onNavigateHome).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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

// The collapsible sidebar (issue #102): a toggle in the sidebar's top row
// collapses it to an icon-only rail at `lg`+, with the choice persisted in
// localStorage like the theme (issue #83). jsdom has no CSS, so the
// collapsed *visuals* (narrow width, hidden labels, "H" mark) live in
// Tailwind `lg:sidebar-collapsed:*` classes asserted as markup; what the
// component itself actually *does* — the toggle, the `title` attributes,
// the html class, and persistence — is asserted as state.
describe('NavShell collapsible sidebar (issue #102)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('sidebar-collapsed')
    localStorage.clear()
  })

  it('shows a collapse toggle in the sidebar top row, expanded by default', () => {
    renderShell()
    expect(sidebar().getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  // jsdom does no layout, so the ~64px collapsed rail and its animation
  // are asserted as the classes that produce them (as with the
  // height-bound shell test above).
  it('animates the width change to a 64px collapsed rail via CSS', () => {
    renderShell()
    expect(screen.getByRole('complementary')).toHaveClass(
      'transition-[width,padding]',
      'duration-200',
      'lg:sidebar-collapsed:w-16',
    )
  })

  it('collapses to an icon-only rail when the toggle is clicked, persisting the choice', () => {
    renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Collapse sidebar' }))

    expect(document.documentElement).toHaveClass('sidebar-collapsed')
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed')
    expect(sidebar().getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('keeps collapsed nav icons clickable and discoverable via title', () => {
    const { onNavigate } = renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Collapse sidebar' }))

    expect(sidebar().getByRole('button', { name: 'Interview' })).toHaveAttribute(
      'title',
      'Interview',
    )
    expect(sidebar().getByRole('button', { name: 'History' })).toHaveAttribute('title', 'History')

    fireEvent.click(sidebar().getByRole('button', { name: 'Interview' }))
    expect(onNavigate).toHaveBeenCalledWith('interview')
  })

  it('replaces the wordmark with an H mark while collapsed, still linking Home', () => {
    const { onNavigateHome } = renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Collapse sidebar' }))

    const mark = sidebar().getByRole('link', { name: /hone/i })
    expect(mark).toHaveAttribute('href', '/')
    // The collapsed "H" mark is present and gated on the collapsed state;
    // the full wordmark is what the CSS hides (issue #100's Home link
    // must hold in the collapsed state too).
    expect(within(mark).getByText('H', { exact: true })).toHaveClass('lg:sidebar-collapsed:inline')
    expect(within(mark).getByText('Hone')).toHaveClass('lg:sidebar-collapsed:hidden')

    fireEvent.click(mark)
    expect(onNavigateHome).toHaveBeenCalledTimes(1)
  })

  it('expands back and persists the expanded choice', () => {
    document.documentElement.classList.add('sidebar-collapsed')
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    renderShell()

    fireEvent.click(sidebar().getByRole('button', { name: 'Expand sidebar' }))

    expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(false)
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('expanded')
    expect(sidebar().getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('restores a persisted collapsed sidebar on mount (no flash of expanded)', () => {
    // What the blocking inline script in __root.tsx does before first
    // paint for a returning user with a stored collapsed preference.
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    document.documentElement.classList.add('sidebar-collapsed')

    renderShell()

    expect(sidebar().getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(sidebar().getByRole('button', { name: 'Interview' })).toHaveAttribute(
      'title',
      'Interview',
    )
  })

  it('leaves the drawer untouched by the collapsed state', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    document.documentElement.classList.add('sidebar-collapsed')

    renderShell()
    const drawer = openDrawer()

    expect(drawer.getByRole('button', { name: 'Interview' })).not.toHaveAttribute('title')
    expect(drawer.getByRole('link', { name: /hone/i })).toHaveAttribute('href', '/')
  })
})
