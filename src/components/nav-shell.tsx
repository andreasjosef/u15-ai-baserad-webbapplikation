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
// (issue #100). Settings is a persistent top-bar icon, never a nav row
// (issue #63's nav-content decision), and takes the user to `/settings`
// unchanged.
import { useState, type MouseEvent, type ReactNode } from 'react'

import { HistoryIcon, MenuIcon, MessageSquareIcon, SettingsIcon } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

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
      className={`${WORDMARK_CLASS}${className ? ` ${className}` : ''}`}
    >
      Hone
    </a>
  )
}

export interface NavShellProps {
  // The section currently on screen, for highlighting its row. The
  // layout route passes 'interview' for both the Interview screen and
  // the Task Breakdown review, 'history' for History, and `undefined`
  // for anything else (no row highlighted).
  currentItem?: NavItemId
  // Fired with the chosen row's id — the layout route turns it into a
  // real navigation. A drawer row also closes the drawer as part of the
  // same click (see `handleDrawerNavigate`).
  onNavigate: (item: NavItemId) => void
  // Fired by the wordmark link's plain clicks — the layout route
  // navigates to the standalone Home page (`/`) client-side.
  onNavigateHome: () => void
  // Fired by the persistent top-bar Settings icon; the layout route
  // navigates to the existing `/settings` route unchanged.
  onOpenSettings: () => void
  children: ReactNode
}

function NavRow({
  item,
  active,
  onSelect,
}: {
  item: NavItem
  active: boolean
  onSelect: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {item.label}
    </button>
  )
}

// The same row set in the permanent sidebar and the drawer — only the
// select handler differs (the drawer's also closes itself).
function NavList({
  currentItem,
  onSelect,
}: {
  currentItem?: NavItemId
  onSelect: (item: NavItemId) => void
}) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavRow
          key={item.id}
          item={item}
          active={item.id === currentItem}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </nav>
  )
}

export function NavShell({
  currentItem,
  onNavigate,
  onNavigateHome,
  onOpenSettings,
  children,
}: NavShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // A drawer row closes the drawer as part of the same interaction; the
  // permanent sidebar has nothing to close.
  function handleDrawerNavigate(item: NavItemId) {
    setDrawerOpen(false)
    onNavigate(item)
  }

  // Same for the drawer's wordmark link; the sidebar's and top bar's
  // have no drawer to close.
  function handleDrawerWordmarkClick() {
    setDrawerOpen(false)
    onNavigateHome()
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Permanent sidebar — lg and up. */}
      <aside className="hidden w-56 shrink-0 flex-col gap-8 border-r border-border bg-sidebar p-4 lg:flex">
        <Wordmark onNavigateHome={onNavigateHome} />
        <NavList currentItem={currentItem} onSelect={onNavigate} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Persistent top bar: the hamburger (below lg only) and the
            Settings icon (always). */}
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
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
            </SheetContent>
          </Sheet>

          <Wordmark className="lg:hidden" onNavigateHome={onNavigateHome} />

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              aria-label="Settings"
            >
              <SettingsIcon aria-hidden="true" />
            </Button>
          </div>
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
