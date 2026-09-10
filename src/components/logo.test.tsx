// Tests for the Hone logo mark (issue #104). The mark is an inline SVG
// component generated from the cleaned Recraft export (C2PA metadata
// stripped, dot/crescent gap tightened to a hairline) — not a static
// asset. It renders purely decoratively everywhere it's used (the
// accessible name always comes from adjacent text), so `aria-hidden` is
// baked in, and its internal gradient ids are namespaced per instance so
// several Logos can share a document (sidebar + top bar + homepage).
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Logo } from './logo.tsx'

describe('Logo', () => {
  it('renders the mark as an inline svg, not a static asset', () => {
    const { container } = render(<Logo className="size-4" />)

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('viewBox', '0 0 1024 1024')
    expect(container.querySelector('img')).toBeNull()
  })

  it('is decorative: aria-hidden is baked in', () => {
    const { container } = render(<Logo />)

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    // No accessible node leaks out from under the decoration.
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('carries the brand mark (the purple crescent and dot)', () => {
    const { container } = render(<Logo />)

    const brandPaths = Array.from(container.querySelectorAll('path[fill="#9E42F2"]'))
    expect(brandPaths.length).toBeGreaterThanOrEqual(2)
  })

  it('namespaces its gradient ids so multiple Logos can coexist in one document', () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    )

    const gradientIds = Array.from(container.querySelectorAll('linearGradient')).map(
      (gradient) => gradient.getAttribute('id'),
    )
    expect(gradientIds.length).toBeGreaterThanOrEqual(2)
    expect(new Set(gradientIds).size).toBe(gradientIds.length)
  })
})
