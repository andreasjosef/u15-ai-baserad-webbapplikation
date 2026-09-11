import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom implements no layout, so Element.scrollTo (used by the
// Interview's auto-scroll, issue #88) doesn't exist. A no-op stub keeps
// component effects from crashing; individual tests replace it with a
// spy where the call itself is what's asserted.
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = () => {}
}

// Testing Library's automatic cleanup only registers itself when globals
// (including `afterEach`) exist — this project disables Vitest globals,
// so tests import them explicitly and cleanup has to be wired up here.
afterEach(() => {
  cleanup()
})
