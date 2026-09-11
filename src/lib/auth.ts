// Better Auth configuration. Kept at this path (one of the CLI's default
// discovery locations) so `npx auth@latest generate` finds it without a
// `--config` flag.
//
// Tables are generated via `npx auth@latest generate` into
// `src/lib/server/db/schema/auth.ts` (left structurally untouched) and
// migrated via ordinary `drizzle-kit generate`/`migrate` — see
// drizzle.config.ts and docs/research.md §4.2. Never run `auth migrate`
// against this schema; it's a competing migrator that fights Drizzle Kit's
// own migration bookkeeping.
//
// Known drift: the generated schema still carries `account.issuer`, a
// legacy column from Better Auth 1.7.0–1.7.2. It is harmless at the
// pinned version but will break account inserts on any upgrade past
// 1.7.2 and must be dropped first — tracked in issue #71.
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from './server/db/client.ts'
import * as schema from './server/db/schema/index.ts'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // Holds `base64(iv || authTag || ciphertext)` — see ADR-0002. Never
      // settable through the sign-up/update-user API (`input: false`) and
      // never sent back to the client (`returned: false`); it's written and
      // read only by server-side code that talks to Todoist directly.
      todoistToken: {
        type: 'string',
        required: false,
        input: false,
        returned: false,
      },
      // Same ADR-0002 contract as todoistToken: `base64(iv || authTag ||
      // ciphertext)`, written and read only by server-side code that talks
      // to OpenRouter — never settable through the sign-up/update-user API
      // and never sent back to the client (issue #136).
      openrouterApiKey: {
        type: 'string',
        required: false,
        input: false,
        returned: false,
      },
    },
  },
  // Must be the last plugin so sign-in/up cookies are actually written
  // through TanStack Start's response-cookie machinery (docs/research.md
  // §4.1) instead of a raw Set-Cookie header Start would drop.
  plugins: [tanstackStartCookies()],
})
