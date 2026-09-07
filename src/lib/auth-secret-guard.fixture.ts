// Fixture for auth-secret-guard.test.ts (issue #35) — run only as a
// standalone subprocess, never imported directly. Better Auth skips its
// secret check entirely whenever NODE_ENV is "test" (vitest's default), so
// the only way to exercise the real production-mode check against this
// app's actual src/lib/auth.ts is a real process boundary with NODE_ENV
// forced to "production" before better-auth's env module is ever imported.
import { auth } from './auth.ts'

try {
  await auth.$context
  process.stdout.write('OK\n')
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stdout.write(`ERROR: ${message}\n`)
  process.exitCode = 1
}
