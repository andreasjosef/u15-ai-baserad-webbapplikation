// React side of the light/dark toggle (issue #83). The actual resolution
// of "which theme" already happened before this hook ever runs — the
// blocking inline script in `__root.tsx`'s <head> set (or didn't set)
// `.dark` on `<html>` before hydration. This hook just reads that result
// into state (in an effect, not the `useState` initializer, so the
// client's first render matches the server-rendered markup instead of
// racing ahead of hydration) and, from then on, is the one place that
// changes it.
import { useEffect, useState } from 'react'

import { applyTheme, readAppliedTheme, type Theme } from '@/lib/theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(readAppliedTheme())
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return { theme, toggleTheme }
}
