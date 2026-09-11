// Barrel combining Better Auth's own tables with the app's own tables into
// one Drizzle schema — one linear migration history, per ADR-0001 and
// docs/research.md §4.2.
export * from './auth.ts'
export * from './app.ts'
