// The nav shell (issue #66): the persistent chrome wrapped around the
// post-login working screens — Interview, History, and the Task Breakdown
// review — so moving between them feels like one app rather than three
// disconnected pages. A permanent sidebar at the `lg` breakpoint and up,
// a hamburger-triggered `Sheet` drawer below it.
//
// Pure and presentational like HomePage / TaskReview / HistoryView:
// navigation (rows and the wordmark's Home link), and the settings
// action arrive as injected callbacks, the current section as a prop,
// and the screen itself as `children`. It does no routing, data-fetching,
// or auth check of its own — the layout route (src/routes/_shell.tsx)
// wires all of that in. There is no `docs/plan.md` section for the
// shell; the nav content is fixed by issue #63 and the "Interview" /
// "Task Breakdown" terms are as defined in `CONTEXT.md`.
//
// One genuinely responsive shell, not two components behind a manual
// toggle: the sidebar is `hidden lg:flex`, the drawer trigger `lg:hidden`,
// both always in the DOM, and the real `lg:` CSS breakpoint is the only
// thing deciding which is visible. Nav rows are Interview and History
// only — History already covers "my todos", so there is no separate row
// for it, and Home is reached through the wordmark link instead of a row
// (issue #100). Settings is not a nav row: it renders as a Settings-icon
// row, styled like a NavRow, at the bottom of the sidebar and the drawer.
//
// Decision log (issue #115): this layout supersedes two earlier
// decisions. #63's "Settings is a persistent top-bar icon, never a nav
// row" and #83's "self-contained `ThemeToggle` in the top bar" are both
// withdrawn — the persistent header is gone entirely at `lg`+, and
// Settings and the theme toggle now live in rows at the bottom of the
// sidebar (and the drawer standing in for it below `lg`), separated from
// the main nav rows by a divider. Settings still takes the user to
// `/settings` unchanged, and the theme toggle is still self-contained.
//
// Since issue #102 the permanent sidebar is also collapsible to an
// icon-only rail: a toggle in its top row flips a `sidebar-collapsed`
// class on `<html>` (via `useSidebar`, persisted like the theme), and the
// collapsed visuals — narrow width, hidden labels, logo-only wordmark —
// are pure `lg:sidebar-collapsed:*` CSS on the markup below. The drawer
// is untouched: it only exists below `lg`, where collapse doesn't apply.
//
// Since issue #104 the wordmark's mark is the Hone logo (an inline SVG,
// see src/components/logo.tsx) instead of bare text: expanded it pairs
// with the "Hone" text, collapsed to the icon-only rail it stands alone.
import { useState, type MouseEvent, type ReactNode } from 'react'

import {
  HistoryIcon,
  MenuIcon,
  MessageSquareIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
} from 'lucide-react'

import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useSidebar } from '@/hooks/use-sidebar'

export type NavItemId = 'interview' | 'history'

interface NavItem {
  id: NavItemId
  label: string
  icon: typeof MessageSquareIcon
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'interview', label: 'Interview', icon: MessageSquareIcon },
  { id: 'history', label: 'History', icon: HistoryIcon },
]

// The "HONE" wordmark treatment from the mockups (issue #62): uppercase,
// tracked, brand purple. Shared verbatim by the sidebar, the drawer
// title, and the small-screen top bar.
const WORDMARK_CLASS =
  'font-heading text-lg font-bold tracking-[0.15em] text-primary uppercase'

// Since issue #100 the wordmark is the Home link: rendered as a real
// `<a href="/">` so it keeps a link's native affordances (middle-click,
// copy address), while a plain click hands off to the injected callback —
// keeping the shell router-free — so the SPA navigates client-side
// instead of reloading. Modified clicks fall through to the browser.
const HOME_HREF = '/'

// Issue #104: the logo mark is decorative everywhere the wordmark renders
// (the adjacent "Hone" text, or this explicit label, carries the name), so
// it's sized by the caller — `size-4` fits the collapsed rail's 48px
// content width flush against the 32px collapse toggle.
const WORDMARK_LOGO_CLASS = 'size-4 shrink-0'

function Wordmark({
  className,
  onNavigateHome,
}: {
  className?: string
  onNavigateHome: () => void
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    onNavigateHome()
  }

  return (
    <a
      href={HOME_HREF}
      onClick={handleClick}
      aria-label="Hone"
      className={`${WORDMARK_CLASS}${className ? ` ${className}` : ''} flex items-center gap-2`}
    >
      {/* Issues #102/#104: the mark is the logo both expanded and in the
          collapsed rail — only the "Hone" text comes and goes, decided
          purely by CSS (`lg:sidebar-collapsed` variants), so a persisted
          collapsed state renders correctly before hydration. The mark is
          aria-hidden; the link's explicit aria-label keeps its accessible
          name "Hone" in the collapsed rail, where no visible text remains.
          The link itself never unmounts: issue #100's Home link must hold
          while collapsed. */}
      <Logo className={WORDMARK_LOGO_CLASS} />
      <span className="lg:sidebar-collapsed:hidden">Hone</span>
    </a>
  )
}

export interface NavShellProps {
  // The section currently on screen, for highlighting its row. The
  // layout route passes 'interview' for both the Interview screen and
  // the Task Breakdown review, 'history' for History, and `undefined`
  // for anything else (no row highlighted).
  currentItem?: NavItemId
  // Issue #117: whether the Settings row should show the active-page
  // treatment (`aria-current="page"`). The layout route computes it from
  // the pathname — Settings is not a `NavItemId`, so it can't flow
  // through `currentItem`.
  settingsActive?: boolean
  // Fired with the chosen row's id — the layout route turns it into a
  // real navigation. A drawer row also closes the drawer as part of the
  // same click (see `handleDrawerNavigate`).
  onNavigate: (item: NavItemId) => void
  // Fired by the wordmark link's plain clicks — the layout route
  // navigates to the standalone Home page (`/`) client-side.
  onNavigateHome: () => void
  // Fired by the Settings row at the bottom of the sidebar and the
  // drawer; the layout route navigates to the existing `/settings`
  // route unchanged.
  onOpenSettings: () => void
  children: ReactNode
}

function NavRow({
  item,
  active,
  onSelect,
  collapsible = false,
}: {
  item: NavItem
  active: boolean
  onSelect: () => void
  // Sidebar-only (issue #102): rows that live in the collapsible sidebar
  // carry a static `title` so the bare icon stays discoverable while the
  // CSS-hidden label is gone. Static — not gated on the collapsed state —
  // so it's present before hydration too, when the persisted rail renders
  // collapsed but React state hasn't synced yet. The drawer never
  // collapses and keeps its exact current markup, so it doesn't set this.
  collapsible?: boolean
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      title={collapsible ? item.label : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors lg:sidebar-collapsed:justify-center ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="lg:sidebar-collapsed:hidden">{item.label}</span>
    </button>
  )
}

// The same row set in the permanent sidebar and the drawer — only the
// select handler differs (the drawer's also closes itself), and only the
// sidebar's rows participate in the collapsed rail (issue #102).
function NavList({
  currentItem,
  onSelect,
  collapsible = false,
}: {
  currentItem?: NavItemId
  onSelect: (item: NavItemId) => void
  collapsible?: boolean
}) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavRow
          key={item.id}
          item={item}
          active={item.id === currentItem}
          collapsible={collapsible}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </nav>
  )
}

// Issue #117: the Account Settings row at the bottom of the sidebar and
// the drawer. Deliberately a separate component rather than a member of
// `NAV_ITEMS` — Settings is not a `NavItemId` (there is no
// `NAV_DESTINATIONS` entry for it; the layout route owns `/settings`) —
// but it mirrors NavRow's markup and classes verbatim so it reads as a
// sibling row. Same props pattern too: `active` drives
// `aria-current="page"`, and `collapsible` gives the collapsed rail a
// static `title` exactly as `NavRow` does (issue #102).
function SettingsRow({
  active,
  onSelect,
  collapsible = false,
}: {
  active: boolean
  onSelect: () => void
  collapsible?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      title={collapsible ? 'Settings' : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors lg:sidebar-collapsed:justify-center ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <SettingsIcon className="size-4" aria-hidden="true" />
      <span className="lg:sidebar-collapsed:hidden">Settings</span>
    </button>
  )
}

// Issue #117: the shared bottom block of the sidebar and the drawer — a
// divider separating the main nav rows from the Settings row and the
// theme toggle, in that order, in both places. The theme toggle renders
// collapsed only in the sidebar (the icon rail); the drawer never
// collapses, so it always gets the row variant. The active state and
// select handler are injected so the two placements can differ (the
// drawer's also closes itself), and `collapsible` follows the sidebar
// (the drawer never collapses, issue #102).
//
// Issue #120: `mt-auto` pins the block to the bottom edge of both
// containers (both are `flex flex-col`) — the same idiom SheetFooter
// uses — so leftover vertical space sits between the nav rows and the
// divider rather than below the theme toggle.
function BottomRows({
  settingsActive,
  onOpenSettings,
  collapsible = false,
  themeToggle,
}: {
  settingsActive: boolean
  onOpenSettings: () => void
  collapsible?: boolean
  themeToggle: ReactNode
}) {
  return (
    <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
      <SettingsRow active={settingsActive} onSelect={onOpenSettings} collapsible={collapsible} />
      {themeToggle}
    </div>
  )
}

export function NavShell({
  currentItem,
  settingsActive,
  onNavigate,
  onNavigateHome,
  onOpenSettings,
  children,
}: NavShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Issue #102: the collapsed/expanded choice of the permanent sidebar.
  // `useSidebar` reads what the blocking init script in `__root.tsx`
  // already applied to `<html>` and persists every change; the collapsed
  // *visuals* are pure CSS (`lg:sidebar-collapsed:*` classes on the
  // markup below), so a persisted state is correct before hydration.
  const { state: sidebarState, toggleSidebar } = useSidebar()
  const sidebarCollapsed = sidebarState === 'collapsed'

  // A drawer row closes the drawer as part of the same interaction; the
  // permanent sidebar has nothing to close.
  function handleDrawerNavigate(item: NavItemId) {
    setDrawerOpen(false)
    onNavigate(item)
  }

  // Same for the drawer's wordmark link and its Settings row; the
  // sidebar's have no drawer to close.
  function handleDrawerWordmarkClick() {
    setDrawerOpen(false)
    onNavigateHome()
  }

  function handleDrawerSettings() {
    setDrawerOpen(false)
    onOpenSettings()
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Permanent sidebar — lg and up. Issue #102: the width (w-56
              expanded, w-16 collapsed rail) is toggled by the
              `lg:sidebar-collapsed:*` classes against the `sidebar-collapsed`
              class `useSidebar` keeps on `<html>`, so the state is correct
              before hydration; `transition-[width,padding]` animates the
              change instead of snapping. */}
      <aside className="hidden w-56 shrink-0 flex-col gap-8 border-r border-border bg-sidebar p-4 transition-[width,padding] duration-200 lg:flex lg:sidebar-collapsed:w-16 lg:sidebar-collapsed:px-2">
        {/* Issue #102: the top row holds the wordmark and the collapse
            toggle in the same spot in both states. In the collapsed rail's
            48px content width the logo mark and the 32px icon button only
            fit flush, so the gap collapses with the sidebar. */}
        <div className="flex items-center justify-between gap-1 lg:sidebar-collapsed:gap-0">
          <Wordmark onNavigateHome={onNavigateHome} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpenIcon aria-hidden="true" />
            ) : (
              <PanelLeftCloseIcon aria-hidden="true" />
            )}
          </Button>
        </div>
        <NavList currentItem={currentItem} onSelect={onNavigate} collapsible />
        {/* Issue #117: Settings and the theme toggle leave the top bar for
            the sidebar's bottom — under a divider, below the main nav
            rows. The theme toggle rides the collapsed rail as an icon
            button (issue #116's `collapsed` prop). */}
        <BottomRows
          settingsActive={Boolean(settingsActive)}
          onOpenSettings={onOpenSettings}
          collapsible
          themeToggle={<ThemeToggle collapsed={sidebarCollapsed} />}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Issue #117: below lg a slim top bar holds only the hamburger
            and the mobile wordmark; at lg and up the bar is hidden
            entirely and the sidebar owns the chrome. The Settings icon
            and the theme toggle that used to sit in the `ml-auto` group
            are gone from here, not relocated within it. */}
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
              >
                <MenuIcon aria-hidden="true" />
              </Button>
            </SheetTrigger>
            {/* The drawer's accessible title is the wordmark link inside
                the SheetTitle below; it has no separate description, so
                the Radix `aria-describedby` is explicitly cleared. */}
            <SheetContent side="left" className="w-64 gap-8 p-4" aria-describedby={undefined}>
              <SheetHeader className="p-0">
                <SheetTitle>
                  <Wordmark onNavigateHome={handleDrawerWordmarkClick} />
                </SheetTitle>
              </SheetHeader>
              <NavList currentItem={currentItem} onSelect={handleDrawerNavigate} />
              {/* Issue #117: the drawer mirrors the sidebar's bottom
                  block — divider, Settings row, theme toggle, same
                  order — and its Settings row closes the drawer like
                  every other drawer row. */}
              <BottomRows
                settingsActive={Boolean(settingsActive)}
                onOpenSettings={handleDrawerSettings}
                themeToggle={<ThemeToggle />}
              />
            </SheetContent>
          </Sheet>

          <Wordmark className="lg:hidden" onNavigateHome={onNavigateHome} />
        </header>

        {/* The screen itself renders its own <main> — the shell adds no
            second landmark. Height-bound shell (issue #86): this wrapper,
            not the page, is what scrolls, so the sidebar and top bar stay
            pinned while tall screens (Interview, History, Task Breakdown
            review) scroll under them. `min-h-0` lets the flex child
            actually shrink below its content height. */}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
