// Tests for the pointer-media module (issue #134): whether the device
// has a fine (mouse/trackpad-class) primary input. The Interview
// composer's autofocus is gated on this so a coarse-pointer device's
// on-screen keyboard is never forced open unsolicited.
import { afterEach, describe, expect, it, vi } from 'vitest'

import { prefersFinePointer } from './pointer.ts'

function mockPointerMedia(fine: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: fine }) as unknown as typeof window.matchMedia,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('prefersFinePointer', () => {
  it('returns true when the primary pointer is fine', () => {
    mockPointerMedia(true)
    expect(prefersFinePointer()).toBe(true)
  })

  it('returns false when the primary pointer is coarse', () => {
    mockPointerMedia(false)
    expect(prefersFinePointer()).toBe(false)
  })

  it('queries the pointer media feature, not color scheme', () => {
    mockPointerMedia(false)
    prefersFinePointer()
    expect(vi.mocked(window.matchMedia)).toHaveBeenCalledWith('(pointer: fine)')
  })

  it('assumes a fine pointer when matchMedia is unsupported', () => {
    // Old browsers without matchMedia are desktop-class; defaulting to
    // fine keeps the keyboard-focused flow working there.
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersFinePointer()).toBe(true)
  })
})
