// The light/dark toggle (issue #83): a `Switch` flanked by small Sun/Moon
// icons, no text label — the icons carry the meaning, the switch's
// `aria-label` carries it for assistive tech. Self-contained (no injected
// callbacks) because, unlike `onOpenSettings`, there's no router or
// parent-specific behavior to wire in — it owns its own global state via
// `useTheme`.
import { MoonIcon, SunIcon } from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/hooks/use-theme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="flex items-center gap-1.5">
      <SunIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      <Switch
        checked={isDark}
        onCheckedChange={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      />
      <MoonIcon className="size-4 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
