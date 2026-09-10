// React side of the collapsible sidebar (issue #102). Mirrors
// `useTheme` (src/hooks/use-theme.ts): the actual resolution of
// "collapsed or expanded" already happened before this hook ever runs —
// the blocking inline script in `__root.tsx`'s <head> added (or didn't
// add) `sidebar-collapsed` on `<html>` before hydration. This hook just
// reads that result into state (in an effect, not the `useState`
// initializer, so the client's first render matches the server-rendered
// markup instead of racing ahead of hydration) and, from then on, is the
// one place that changes it.
import { useEffect, useState } from 'react'

import { applySidebarState, readAppliedSidebarState, type SidebarState } from '@/lib/sidebar'

export function useSidebar() {
  const [state, setState] = useState<SidebarState>('expanded')

  useEffect(() => {
    setState(readAppliedSidebarState())
  }, [])

  function toggleSidebar() {
    // Read the applied state at click time, not the possibly-stale React
    // state: before the mount effect has synced (e.g. a click in the first
    // moments after a persisted-collapsed load), `state` still says
    // 'expanded' and toggling from it would re-apply 'collapsed' — a
    // no-op click. The DOM is the truth, as in `readAppliedSidebarState`.
    const next: SidebarState = readAppliedSidebarState() === 'collapsed' ? 'expanded' : 'collapsed'
    applySidebarState(next)
    setState(next)
  }

  return { state, toggleSidebar }
}
