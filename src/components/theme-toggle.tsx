// The light/dark toggle (issue #83; row + collapsed variants in
// issue #116). Self-contained (no injected callbacks) because, unlike
// `onOpenSettings`, there's no router or parent-specific behavior to wire
// in — it owns its own global state via `useTheme`.
//
// Since #116 it has two renderings, chosen by a `collapsed` prop mirroring
// the `collapsible` prop on NavRow:
//
// - Default (uncollapsed — the expanded sidebar and always the drawer):
//   a settings-row style matching NavRow's markup — fixed Moon leading
//   icon, static "Dark mode" label, and the Switch pushed to the trailing
//   edge. The label never relabels itself; only the switch reflects state.
// - Collapsed (the icon-only sidebar rail, wired up by a follow-up
//   ticket): a single ghost icon button — Sun in light mode, Moon in dark
//   — with `aria-pressed` and a `title` reusing the same switch-mode copy.
//
// Both variants toggle the theme and persist it to localStorage through
// `useTheme`, exactly like the original toggle.
import { MoonIcon, SunIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/hooks/use-theme'

// Same row treatment as NavRow (src/components/nav-shell.tsx): the
// settings row should read as a sibling of the nav rows it sits under.
const ROW_CLASS = 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground'

function switchModeLabel(isDark: boolean) {
  return isDark ? 'Switch to light mode' : 'Switch to dark mode'
}

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const ariaLabel = switchModeLabel(isDark)

  if (collapsed) {
    // Issue #120: a fixed-size `size="icon"` button can't stretch across
    // the rail like the Settings row's unsized button does, so it centers
    // itself explicitly to line up with the Settings icon above it.
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-pressed={isDark}
        aria-label={ariaLabel}
        title={ariaLabel}
        className="mx-auto"
      >
        {isDark ? <MoonIcon aria-hidden="true" /> : <SunIcon aria-hidden="true" />}
      </Button>
    )
  }

  return (
    <div className={ROW_CLASS}>
      <MoonIcon className="size-4" aria-hidden="true" />
      <span>Dark mode</span>
      <Switch
        className="ml-auto"
        checked={isDark}
        onCheckedChange={toggleTheme}
        aria-label={ariaLabel}
      />
    </div>
  )
}
