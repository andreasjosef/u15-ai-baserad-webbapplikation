// Tests for the light/dark theme module (issue #83).
//
// `themeInitScript` is tested by actually `eval`-ing the string it
// returns against a real `document`/`localStorage` — it's the one piece
// of this feature that never runs as typechecked app code (it's a raw
// script tag in `__root.tsx`'s <head>), so a plain "does it contain the
// right substrings" test wouldn't catch a logic mistake in it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { THEME_STORAGE_KEY, applyTheme, readAppliedTheme, themeInitScript } from './theme.ts'

function mockMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: prefersDark }) as unknown as typeof window.matchMedia,
  )
}

function runInitScript() {
  // eslint-disable-next-line no-eval -- exercising the exact source the
  // blocking <script> tag runs, not a re-implementation of it.
  eval(themeInitScript())
}

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('themeInitScript', () => {
  it('applies dark when the stored preference is dark', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    mockMatchMedia(false)
    runInitScript()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('leaves light when the stored preference is light, regardless of system preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    mockMatchMedia(true)
    runInitScript()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('falls back to a dark system preference when nothing is stored', () => {
    mockMatchMedia(true)
    runInitScript()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to light when nothing is stored and the system prefers light', () => {
    mockMatchMedia(false)
    runInitScript()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('falls back to light when matchMedia is unsupported', () => {
    vi.stubGlobal('matchMedia', undefined)
    runInitScript()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('applyTheme / readAppliedTheme', () => {
  it('adds the dark class and reports it back', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(readAppliedTheme()).toBe('dark')
  })

  it('removes the dark class and reports it back', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(readAppliedTheme()).toBe('light')
  })

  it('persists the choice as the explicit stored preference', () => {
    applyTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
