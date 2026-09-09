// The nav shell (issue #66): the persistent chrome wrapped around the
// post-login working screens — Interview, History, and the Task Breakdown
// review — so moving between them feels like one app rather than three
// disconnected pages. A permanent sidebar at the `lg` breakpoint and up,
// a hamburger-triggered `Sheet` drawer below it.
//
// Pure and presentational like HomePage / TaskReview / HistoryView:
// navigation and the settings action arrive as injected callbacks, the
// current section as a prop, and the screen itself as `children`. It does
// no routing, data-fetching, or auth check of its own — the layout route
// (src/routes/_shell.tsx) wires all of that in. There is no `docs/plan.md`
// section for the shell; the nav content is fixed by issue #63 and the
// "Interview" / "Task Breakdown" terms are as defined in `CONTEXT.md`.
//
// One genuinely responsive shell, not two components behind a manual
// toggle: the sidebar is `hidden lg:flex`, the drawer trigger `lg:hidden`,
// both always in the DOM, and the real `lg:` CSS breakpoint is the only
// thing deciding which is visible. Nav rows are Home and History only —
// History already covers "my todos", so there is no separate row for it.
// Settings is a persistent top-bar icon, never a nav row (issue #63's
// nav-content decision), and takes the user to `/settings` unchanged.
import { useState, type ReactNode } from 'react'

import { HistoryIcon, HomeIcon, MenuIcon, SettingsIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export type NavItemId = 'home' | 'history'

interface NavItem {
  id: NavItemId
  label: string
  icon: typeof HomeIcon
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'history', label: 'History', icon: HistoryIcon },
]

// The "HONE" wordmark treatment from the mockups (issue #62): uppercase,
// tracked, brand purple. Shared verbatim by the sidebar, the drawer
// title, and the small-screen top bar.
const WORDMARK_CLASS =
  'font-heading text-lg font-bold tracking-[0.15em] text-primary uppercase'

function Wordmark({ className }: { className?: string }) {
  return <span className={`${WORDMARK_CLASS}${className ? ` ${className}` : ''}`}>Hone</span>
}

export interface NavShellProps {
  // The section currently on screen, for highlighting its row. Interview
  // and the Task Breakdown review are not nav destinations of their own,
  // so they pass `undefined` and no row is highlighted.
  currentItem?: NavItemId
  // Fired with the chosen row's id — the layout route turns it into a
  // real navigation. A drawer row also closes the drawer as part of the
  // same click (see `handleDrawerNavigate`).
  onNavigate: (item: NavItemId) => void
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

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Permanent sidebar — lg and up. */}
      <aside className="hidden w-56 shrink-0 flex-col gap-8 border-r border-border bg-sidebar p-4 lg:flex">
        <Wordmark />
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
            {/* The drawer's accessible title is the wordmark (SheetTitle
                below); it has no separate description, so the Radix
                `aria-describedby` is explicitly cleared. */}
            <SheetContent side="left" className="w-64 gap-8 p-4" aria-describedby={undefined}>
              <SheetHeader className="p-0">
                <SheetTitle className={WORDMARK_CLASS}>Hone</SheetTitle>
              </SheetHeader>
              <NavList currentItem={currentItem} onSelect={handleDrawerNavigate} />
            </SheetContent>
          </Sheet>

          <Wordmark className="lg:hidden" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="ml-auto"
          >
            <SettingsIcon aria-hidden="true" />
          </Button>
        </header>

        {/* The screen itself renders its own <main> — the shell adds no
            second landmark. */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
