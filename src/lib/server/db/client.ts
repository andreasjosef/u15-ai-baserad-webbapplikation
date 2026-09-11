// Postgres connection used by both Drizzle and Better Auth at runtime.
//
// Supabase exposes two connection strings that are NOT interchangeable
// (docs/research.md §4.3): the direct connection (port 5432, used by
// `drizzle-kit generate`/`migrate` — see drizzle.config.ts) and the
// transaction-mode pooler (port 6543, used here, by the running app).
// The transaction pooler doesn't support named prepared statements, so
// `prepare: false` is required on this client.
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema/index.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — see .env.example.')
}

const queryClient = postgres(connectionString, { prepare: false })

export const db = drizzle({ client: queryClient, schema })
