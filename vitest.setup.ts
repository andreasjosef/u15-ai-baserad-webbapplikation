import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library's automatic cleanup only registers itself when globals
// (including `afterEach`) exist — this project disables Vitest globals,
// so tests import them explicitly and cleanup has to be wired up here.
afterEach(() => {
  cleanup()
})
