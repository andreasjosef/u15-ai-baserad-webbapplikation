// Collapsible sidebar persistence (issue #102). The collapsed/expanded
// choice of the permanent sidebar (shown at `lg` and up) follows the
// exact pattern of the light/dark theme (issue #83, `src/lib/theme.ts`):
// the state hangs off a single class on `<html>` (`sidebar-collapsed`),
// and three places need this logic, each with a different runtime:
//   - the blocking inline script in `__root.tsx`'s <head> (raw JS source,
//     not a module — it must run before hydration exists)
//   - `useSidebar` (React state for the toggle, src/hooks/use-sidebar.ts)
//   - tests
// `sidebarInitScript` and `applySidebarState` are the shared source of
// truth so the blocking script and the toggle can never resolve the
// preference differently from each other. Unlike the theme there is no
// system-preference fallback: a first-time visitor sees the sidebar
// expanded, matching the pre-#102 behavior.
export const SIDEBAR_STORAGE_KEY = 'hone-sidebar'

export type SidebarState = 'expanded' | 'collapsed'

// The blocking <script> source rendered inline in `__root.tsx`'s <head>.
// Plain string, not imported app code, because it has to execute as a
// classic synchronous script — before React, before hydration, before
// first paint — so a stored preference for the collapsed rail never
// flashes the expanded sidebar first.
export function sidebarInitScript(): string {
  return `(function(){try{if(localStorage.getItem(${JSON.stringify(
    SIDEBAR_STORAGE_KEY,
  )})==='collapsed'){document.documentElement.classList.add('sidebar-collapsed')}}catch(e){}})();`
}

// What the blocking script (or a previous `applySidebarState` call)
// already set on `<html>`. Read this instead of re-deriving from storage
// so the toggle's first client render agrees with the DOM the script
// produced, rather than a second, possibly different, resolution.
export function readAppliedSidebarState(): SidebarState {
  return document.documentElement.classList.contains('sidebar-collapsed')
    ? 'collapsed'
    : 'expanded'
}

// Applies the state to the document and persists it, so it survives
// reloads (and is honored by the blocking script on the next visit).
export function applySidebarState(state: SidebarState): void {
  document.documentElement.classList.toggle('sidebar-collapsed', state === 'collapsed')
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, state)
  } catch {
    // Storage can be unavailable (private browsing, disabled cookies).
    // The toggle still works for the rest of the session; it just won't
    // persist across reloads.
  }
}
