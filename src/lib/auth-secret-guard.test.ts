// Regression test for issue #35: Vercel had no BETTER_AUTH_SECRET set for
// Production or Preview, so Better Auth silently fell back to its built-in
// DEFAULT_SECRET — a fallback the library only refuses under
// NODE_ENV=production, which Vercel sets for both its Production *and*
// Preview builds (node_modules/better-auth/dist/context/create-context.mjs,
// validateSecret()). Locally, NODE_ENV isn't "production", so this stayed
// invisible in dev.
//
// This runs the real src/lib/auth.ts (via auth-secret-guard.fixture.ts) in
// a subprocess with production semantics forced, since vitest's own
// NODE_ENV=test makes better-auth skip the check entirely (isTest()) and
// so can't exercise this path in-process.
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const tsx = path.resolve(process.cwd(), 'node_modules/.bin/tsx')
const fixture = path.resolve(process.cwd(), 'src/lib/auth-secret-guard.fixture.ts')

async function runFixture(env: Record<string, string>): Promise<{ stdout: string; failed: boolean }> {
  try {
    const { stdout } = await execFileAsync(tsx, [fixture], { env: { PATH: process.env.PATH ?? '', ...env } })
    return { stdout, failed: false }
  } catch (err) {
    const { stdout } = err as { stdout?: string }
    return { stdout: stdout ?? '', failed: true }
  }
}

describe('Better Auth secret guard (issue #35)', () => {
  it('refuses the default secret under production semantics', async () => {
    const { stdout, failed } = await runFixture({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/hone',
    })
    expect(failed).toBe(true)
    expect(stdout).toContain('You are using the default secret')
  })

  it('starts cleanly once BETTER_AUTH_SECRET is set', async () => {
    const { stdout, failed } = await runFixture({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/hone',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'https://example.vercel.app',
    })
    expect(failed).toBe(false)
    expect(stdout).toContain('OK')
  })
})
