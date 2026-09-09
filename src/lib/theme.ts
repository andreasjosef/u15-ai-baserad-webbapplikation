// Light/dark theme (issue #83). The whole scheme hangs off a single
// `.dark` class on `<html>` — `src/styles.css` already defines both token
// sets keyed on that class (`@custom-variant dark (&:is(.dark *))`), so
// applying/removing it is the entire visual effect; nothing here decides
// colors.
//
// Three places need this logic and each has a different runtime:
//   - the blocking inline script in `__root.tsx`'s <head> (raw JS source,
//     not a module — it must run before hydration exists)
//   - `useTheme` (React state for the toggle)
//   - tests
// `themeInitScript` and `applyTheme` are the shared source of truth so the
// blocking script and the toggle can never resolve a preference
// differently from each other.
export const THEME_STORAGE_KEY = 'hone-theme'

export type Theme = 'light' | 'dark'

// The blocking <script> source rendered inline in `__root.tsx`'s <head>.
// Plain string, not imported app code, because it has to execute as a
// classic synchronous script — before React, before hydration, before
// first paint — so a stored (or system) preference for dark never flashes
// light first. Mirrors the fallback order `useTheme` uses once React is
// running: stored preference, else `prefers-color-scheme`, else light.
export function themeInitScript(): string {
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`
}

// What the blocking script (or a previous `applyTheme` call) already set
// on `<html>`. Read this instead of re-deriving from storage/system
// preference so the toggle's first client render agrees with the DOM the
// script produced, rather than a second, possibly different, resolution.
export function readAppliedTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

// Applies the theme to the document and persists it as the explicit
// choice, taking priority over system preference on future visits.
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private browsing, disabled cookies).
    // The toggle still works for the rest of the session; it just won't
    // persist across reloads.
  }
}
