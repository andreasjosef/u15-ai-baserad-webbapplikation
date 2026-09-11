// The pathless layout route (issue #66) that renders the nav shell once
// around the post-login working screens — Interview (`/interview`),
// History (`/history`), and the Task Breakdown review
// (`/interview/$sessionId`). The `_shell` segment adds nothing to any
// URL; the standalone Home page, log in, and sign up sit outside this
// route and are unaffected — the shell's wordmark links there (issue
// #100).
//
// This is where the pure NavShell component (src/components/nav-shell.tsx)
// gets its router wiring: the current section is derived from the
// pathname, nav rows and the wordmark link become real navigations, and
// the Settings row (issue #117: now at the bottom of the sidebar/drawer,
// no longer a top-bar icon) goes to the existing `/settings` route
// unchanged. The per-screen auth guards stay on the child routes — this
// layer adds no `beforeLoad` of its own.
import { Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'

import { NavShell, type NavItemId } from '../components/nav-shell.tsx'

// Single source of truth for where each nav row goes. Typed as a total
// `Record`, so adding a `NavItemId` without a destination is a compile
// error rather than a silent fallthrough. The wordmark's `/` destination
// is deliberately not here — it is a link, not a nav row (issue #100).
const NAV_DESTINATIONS: Record<NavItemId, '/interview' | '/history'> = {
  interview: '/interview',
  history: '/history',
}

export const Route = createFileRoute('/_shell')({
  component: ShellLayout,
})

function ShellLayout() {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (location) => location.pathname })

  // The Interview row covers both the conversation screen and the Task
  // Breakdown review (`/interview/$sessionId`, same URL prefix); History
  // stays an exact match, as before.
  const currentItem: NavItemId | undefined =
    pathname === NAV_DESTINATIONS.history
      ? 'history'
      : pathname === NAV_DESTINATIONS.interview || pathname.startsWith(`${NAV_DESTINATIONS.interview}/`)
        ? 'interview'
        : undefined

  // Issue #117: the layout route knows when it's rendering `/settings`,
  // so it computes the Settings row's active state here — Settings is not
  // a `NavItemId`, so it can't flow through `currentItem`. The settings
  // route is a single page, so an exact match is enough (same rule as
  // History above).
  const settingsActive = pathname === '/settings'

  return (
    <NavShell
      currentItem={currentItem}
      settingsActive={settingsActive}
      onNavigate={(item) => {
        void navigate({ to: NAV_DESTINATIONS[item] })
      }}
      onNavigateHome={() => {
        void navigate({ to: '/' })
      }}
      onOpenSettings={() => {
        // Issue #135: settings now lives under this layout, and its
        // back-link returns to the referrer — so the entry point passes
        // the current path along as the `from` search param.
        void navigate({ to: '/settings', search: { from: pathname } })
      }}
    >
      <Outlet />
    </NavShell>
  )
}
