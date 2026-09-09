// Unit tests for the near-bottom check behind the Interview's
// auto-scroll (issue #88). Pure numeric inputs, no DOM — jsdom has no
// layout, so the threshold logic must be testable without it.
import { describe, expect, it } from 'vitest'

import { isNearBottom } from './scroll-near-bottom.ts'

describe('isNearBottom', () => {
  it('is true exactly at the bottom', () => {
    expect(
      isNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 500 }),
    ).toBe(true)
  })

  it('is true within the threshold above the bottom', () => {
    // 32px shy of the bottom, under a 48px threshold.
    expect(
      isNearBottom({ scrollTop: 468, scrollHeight: 1000, clientHeight: 500 }),
    ).toBe(true)
  })

  it('is false beyond the threshold above the bottom', () => {
    // 120px shy of the bottom — the user has scrolled up to reread.
    expect(
      isNearBottom({ scrollTop: 380, scrollHeight: 1000, clientHeight: 500 }),
    ).toBe(false)
  })

  it('treats the threshold boundary itself as near', () => {
    // Exactly 48px shy of the bottom with a 48px threshold.
    expect(
      isNearBottom({ scrollTop: 452, scrollHeight: 1000, clientHeight: 500 }),
    ).toBe(true)
  })

  it('accepts an explicit threshold', () => {
    const metrics = { scrollTop: 440, scrollHeight: 1000, clientHeight: 500 }
    expect(isNearBottom(metrics, 60)).toBe(true)
    expect(isNearBottom(metrics, 60 - 1)).toBe(false)
  })

  it('is true when the content is shorter than the viewport (nothing to scroll)', () => {
    expect(
      isNearBottom({ scrollTop: 0, scrollHeight: 300, clientHeight: 500 }),
    ).toBe(true)
  })
})
