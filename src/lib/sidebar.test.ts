// Tests for the collapsible-sidebar persistence module (issue #102).
//
// Mirrors theme.test.ts: the module follows the same pattern as the
// light/dark theme (issue #83) — a blocking inline script in `__root.tsx`'s
// <head> applies the stored choice before first paint, so a stored
// "collapsed" preference never flashes the expanded sidebar first.
// `sidebarInitScript` is tested by actually `eval`-ing the string it
// returns against a real `document`/`localStorage` — it's the one piece
// of this feature that never runs as typechecked app code (it's a raw
// script tag in `__root.tsx`'s <head>), so a plain "does it contain the
// right substrings" test wouldn't catch a logic mistake in it.
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SIDEBAR_STORAGE_KEY,
  applySidebarState,
  readAppliedSidebarState,
  sidebarInitScript,
} from './sidebar.ts'

function runInitScript() {
  // eslint-disable-next-line no-eval -- exercising the exact source the
  // blocking <script> tag runs, not a re-implementation of it.
  eval(sidebarInitScript())
}

beforeEach(() => {
  document.documentElement.classList.remove('sidebar-collapsed')
  localStorage.clear()
})

describe('sidebarInitScript', () => {
  it('adds the collapsed class when the stored preference is collapsed', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    runInitScript()
    expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(true)
  })

  it('leaves the sidebar expanded when the stored preference is expanded', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'expanded')
    runInitScript()
    expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(false)
  })

  it('leaves the sidebar expanded when nothing is stored (first-time visitor)', () => {
    runInitScript()
    expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(false)
  })

  it('leaves the sidebar expanded when an unrecognized value is stored', () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, 'garbage')
    runInitScript()
    expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(false)
  })

  it('does nothing when localStorage is unavailable', () => {
    const original = window.localStorage
    // Simulate storage throwing on access (private browsing etc.).
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage unavailable')
      },
    })
    try {
      expect(() => runInitScript()).not.toThrow()
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: original,
      })
    }
    expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(false)
  })
})

describe('applySidebarState / readAppliedSidebarState', () => {
  it('applies collapsed and reads it back', () => {
    applySidebarState('collapsed')
    expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(true)
    expect(readAppliedSidebarState()).toBe('collapsed')
  })

  it('applies expanded and reads it back', () => {
    document.documentElement.classList.add('sidebar-collapsed')
    applySidebarState('expanded')
    expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(false)
    expect(readAppliedSidebarState()).toBe('expanded')
  })

  it('persists the choice as the explicit stored preference', () => {
    applySidebarState('collapsed')
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed')
    applySidebarState('expanded')
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('expanded')
  })

  it('still applies the state when persisting fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    try {
      applySidebarState('collapsed')
      expect(document.documentElement.classList.contains('sidebar-collapsed')).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
  })
})
