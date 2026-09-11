// Drizzle Kit config. `generate` only reads the schema files below (no DB
// connection needed); `migrate` applies the resulting SQL against
// MIGRATION_DATABASE_URL, Supabase's direct connection (port 5432) — never
// the transaction pooler used by the running app (docs/research.md §4.3).
import { defineConfig } from 'drizzle-kit'

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
if (!migrationDatabaseUrl) {
  throw new Error('MIGRATION_DATABASE_URL (or DATABASE_URL) is not set — see .env.example.')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/server/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: migrationDatabaseUrl,
  },
})
