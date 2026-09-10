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

import { THEME_STORAGE_KEY } from '../lib/theme.ts'
import { SIDEBAR_STORAGE_KEY } from '../lib/sidebar.ts'
import { NavShell, type NavItemId } from './nav-shell.tsx'

function renderShell({
  currentItem,
  settingsActive,
}: { currentItem?: NavItemId; settingsActive?: boolean } = {}) {
  const onNavigate = vi.fn()
  const onNavigateHome = vi.fn()
  const onOpenSettings = vi.fn()
  render(
    <NavShell
      currentItem={currentItem}
      settingsActive={settingsActive}
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
    renderShell({ currentItem: 'history' })
    expect(sidebar().getByRole('button', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(sidebar().getByRole('button', { name: 'Interview' })).not.toHaveAttribute('aria-current')
  })

  it('highlights the Interview row when it is the current item (issue #100)', () => {
    renderShell({ currentItem: 'interview' })
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
  // the injected callback so the SPA navigates client-side. Since #104 the
  // link is the logo mark + "Hone" text lockup; the mark is decorative
  // (aria-hidden) and the link carries an explicit aria-label, so the
  // accessible name is exactly "Hone" in every state.
  it('renders the wordmark as a Home link in the sidebar and the mobile top bar', () => {
    renderShell()
    expect(sidebar().getByRole('link', { name: 'Hone' })).toHaveAttribute('href', '/')
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Hone' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  // Issue #104: the wordmark is the Hone logo mark beside the "Hone" text
  // everywhere it renders — desktop sidebar, mobile top bar, and the
  // drawer's SheetTitle; the mark carries no name of its own — the text
  // (and the link's label) do.
  it('pairs the logo mark with the Hone text in every wordmark lockup', () => {
    renderShell()

    for (const link of [
      sidebar().getByRole('link', { name: 'Hone' }),
      within(screen.getByRole('banner')).getByRole('link', { name: 'Hone' }),
    ]) {
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(link).toHaveTextContent('Hone')
    }

    // The drawer's SheetTitle is the third lockup.
    const drawer = openDrawer()
    const drawerLink = drawer.getByRole('link', { name: 'Hone' })
    expect(drawerLink.querySelector('svg')).not.toBeNull()
    expect(drawerLink).toHaveTextContent('Hone')
  })

  // Issue #134: the wordmark's mark grows one size tier (size-4 →
  // size-5) in the expanded sidebar, the mobile top bar, and the drawer.
  // The collapsed rail is pinned back to its current size via the
  // breakpoint-scoped override — it has zero pixel slack against the
  // 32px collapse toggle in the rail's 48px content width. Class
  // membership is the only observable, jsdom having no layout.
  it('renders the wordmark mark one size tier larger, pinned back down in the collapsed rail', () => {
    renderShell()

    for (const link of [
      sidebar().getByRole('link', { name: 'Hone' }),
      within(screen.getByRole('banner')).getByRole('link', { name: 'Hone' }),
      openDrawer().getByRole('link', { name: 'Hone' }),
    ]) {
      const mark = link.querySelector('svg')
      expect(mark).toHaveClass('size-5')
      expect(mark).not.toHaveClass('size-4')
    }
  })

  it("keeps the collapsed rail's logo at its current size via the breakpoint-scoped override", () => {
    renderShell()
    expect(sidebar().getByRole('link', { name: 'Hone' }).querySelector('svg')).toHaveClass(
      'lg:sidebar-collapsed:size-4',
    )
  })

  it('navigates home when a wordmark link is clicked', () => {
    const { onNavigateHome, onNavigate } = renderShell()
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Hone' }))
    expect(onNavigateHome).toHaveBeenCalledTimes(1)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('navigates home from the drawer wordmark too, closing the drawer', async () => {
    const { onNavigateHome } = renderShell()
    openDrawer()

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Hone' }))
    expect(onNavigateHome).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  // Issue #117: Settings leaves the top bar for a NavRow-styled row at the
  // bottom of the sidebar and the drawer — it fires onOpenSettings in both,
  // and the drawer's row closes the drawer like every other drawer row.
  it('fires onOpenSettings from the sidebar Settings row', () => {
    const { onOpenSettings } = renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('fires onOpenSettings from the drawer Settings row and closes the drawer', async () => {
    const { onOpenSettings } = renderShell()
    openDrawer()

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('highlights the Settings row via aria-current when settingsActive is true', () => {
    renderShell({ settingsActive: true })
    expect(sidebar().getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // The nav rows stay unhighlighted — Settings is not a NavItemId.
    expect(sidebar().getByRole('button', { name: 'Interview' })).not.toHaveAttribute('aria-current')
    expect(openDrawer().getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('marks no row with aria-current when settingsActive is undefined', () => {
    renderShell()
    expect(sidebar().getByRole('button', { name: 'Settings' })).not.toHaveAttribute('aria-current')
    expect(openDrawer().getByRole('button', { name: 'Settings' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  // Issue #117: the theme toggle and Settings relocate from the top bar
  // into the sidebar and the drawer; the top bar keeps only the hamburger
  // and the mobile wordmark.
  it('shows the theme toggle in the sidebar and the drawer, never in the top bar', () => {
    renderShell()
    expect(sidebar().getByRole('switch')).toBeInTheDocument()
    // The top bar keeps only the hamburger and the wordmark (queried
    // before opening the drawer, which aria-hides everything outside it).
    expect(within(screen.getByRole('banner')).queryByRole('switch')).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: /settings/i })).not.toBeInTheDocument()
    expect(openDrawer().getByRole('switch')).toBeInTheDocument()
  })

  // jsdom does no CSS, so the divider between the main NavList and the
  // Settings/theme rows is asserted as the border treatment itself — the
  // same `border-border` token the header's `border-b` and the aside's
  // `border-r` already use.
  it('separates the nav rows from the Settings/theme rows with a divider', () => {
    renderShell()
    const sidebarDivider = screen
      .getByRole('complementary')
      .querySelector('.border-t.border-border')
    expect(sidebarDivider).not.toBeNull()

    openDrawer()
    expect(screen.getByRole('dialog').querySelector('.border-t.border-border')).not.toBeNull()
  })

  // Issue #120: the bottom block pins to the bottom edge of the sidebar
  // and the drawer — `mt-auto` (the SheetFooter idiom) absorbs any
  // leftover column space above the divider, so the Settings/theme rows
  // never float mid-column. jsdom does no layout, so the pin is asserted
  // as the class that produces it, in both placements.
  it('pins the Settings/theme block to the bottom edge of the sidebar and the drawer', () => {
    renderShell()
    const sidebarDivider = screen
      .getByRole('complementary')
      .querySelector('.border-t.border-border')
    expect(sidebarDivider).toHaveClass('mt-auto')

    openDrawer()
    expect(screen.getByRole('dialog').querySelector('.border-t.border-border')).toHaveClass(
      'mt-auto',
    )
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
    renderShell({ currentItem: 'history' })
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
    document.documentElement.classList.remove('dark')
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

  // Issue #104: the collapsed rail shows the logo mark alone — the "H"
  // letter fallback is gone. The mark stays decorative; the link carries
  // the accessible name explicitly, since no visible text remains.
  it('replaces the wordmark with the logo mark while collapsed, still linking Home', () => {
    const { onNavigateHome } = renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Collapse sidebar' }))

    const mark = sidebar().getByRole('link', { name: 'Hone' })
    expect(mark).toHaveAttribute('href', '/')
    expect(mark).toHaveAttribute('aria-label', 'Hone')
    // The mark is present and gated on the collapsed state; the "Hone"
    // text is what the CSS hides (issue #100's Home link must hold in
    // the collapsed state too).
    expect(mark.querySelector('svg')).not.toBeNull()
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

  // Issue #117: in the collapsed icon rail the theme toggle renders as
  // its collapsed icon-button variant (`role="button"` with
  // `aria-pressed`, not `role="switch"`) — the ThemeToggle `collapsed`
  // prop from issue #116 — and still toggles the theme.
  it('renders the theme toggle as an aria-pressed icon button in the collapsed rail and toggles the theme', () => {
    renderShell()
    fireEvent.click(sidebar().getByRole('button', { name: 'Collapse sidebar' }))

    const toggle = sidebar().getByRole('button', { name: /switch to (dark|light) mode/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(sidebar().queryByRole('switch')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('leaves the drawer untouched by the collapsed state', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    document.documentElement.classList.add('sidebar-collapsed')

    renderShell()
    const drawer = openDrawer()

    expect(drawer.getByRole('button', { name: 'Interview' })).not.toHaveAttribute('title')
    expect(drawer.getByRole('link', { name: 'Hone' })).toHaveAttribute('href', '/')
  })
})
