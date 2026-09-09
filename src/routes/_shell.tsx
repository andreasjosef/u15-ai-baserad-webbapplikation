// The pathless layout route (issue #66) that renders the nav shell once
// around the post-login working screens — Interview (`/interview`),
// History (`/history`), and the Task Breakdown review
// (`/interview/$sessionId`). The `_shell` segment adds nothing to any
// URL; Home, log in, and sign up sit outside this route and are
// unaffected.
//
// This is where the pure NavShell component (src/components/nav-shell.tsx)
// gets its router wiring: the current section is derived from the
// pathname, nav rows become real navigations, and the Settings icon goes
// to the existing `/settings` route unchanged. The per-screen auth guards
// stay on the child routes — this layer adds no `beforeLoad` of its own.
import { Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'

import { NavShell, type NavItemId } from '../components/nav-shell.tsx'

// Single source of truth for where each nav row goes. Typed as a total
// `Record`, so adding a `NavItemId` without a destination is a compile
// error rather than a silent fallthrough.
const NAV_DESTINATIONS: Record<NavItemId, '/' | '/history'> = {
  home: '/',
  history: '/history',
}

export const Route = createFileRoute('/_shell')({
  component: ShellLayout,
})

function ShellLayout() {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (location) => location.pathname })

  // Only History is a nav destination that can be "current"; Interview
  // and the review screen highlight no row.
  const currentItem: NavItemId | undefined =
    pathname === NAV_DESTINATIONS.history ? 'history' : undefined

  return (
    <NavShell
      currentItem={currentItem}
      onNavigate={(item) => {
        void navigate({ to: NAV_DESTINATIONS[item] })
      }}
      onOpenSettings={() => {
        void navigate({ to: '/settings' })
      }}
    >
      <Outlet />
    </NavShell>
  )
}
