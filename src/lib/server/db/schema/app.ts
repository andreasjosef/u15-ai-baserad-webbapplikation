// The app's own tables, alongside Better Auth's generated ones (./auth.ts)
// in one unified schema/migration history — settled in issue #6's
// resolution comment, folded into docs/plan.md §9 and CONTEXT.md.
//
// Phase (Defining/Drilling/Proposed/Completed) is never persisted as its
// own column — it's always derived from which rows/tool-call messages
// exist so far (CONTEXT.md's Phase entry):
//   Defining  — no `mark_checkpoint` message
//   Drilling  — a `mark_checkpoint` message exists
//   Proposed  — a `propose_task_breakdown` message exists
//   Completed — `interview_sessions.todoist_project_id` is set
import { relations } from 'drizzle-orm'
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { user } from './auth.ts'

// The persisted row an Interview happens within (CONTEXT.md's Session
// entry). Named `interview_sessions`, not `session`, to avoid colliding
// with Better Auth's own generated `session` table (login session).
export const interviewSessions = pgTable(
  'interview_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Cached, set when `mark_checkpoint` fires — lets the History view
    // render a list without joining out to the transcript per row.
    projectSummary: text('project_summary'),
    // Cached, set when `propose_task_breakdown` fires.
    projectTitle: text('project_title'),
    // Set once `create_todoist_tasks` succeeds; doubles as the
    // Completed-phase signal.
    todoistProjectId: text('todoist_project_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('interview_sessions_user_id_idx').on(table.userId)],
)

// The full Interview transcript, normalized rather than a JSONB blob:
// Phase derivation needs a plain indexed query against this table, and
// appending a turn is a plain INSERT rather than a read-modify-write of a
// growing blob (issue #6's storage-shape rationale).
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => interviewSessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content'),
    // Set on the two model-initiated tool calls (`mark_checkpoint`,
    // `propose_task_breakdown`); Phase derivation reads this column.
    toolName: text('tool_name'),
    toolArgs: jsonb('tool_args'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('messages_session_id_idx').on(table.sessionId)],
)

// The resulting Task Breakdown, normalized rather than a JSONB blob: the
// review/edit UI needs per-task row identity (add/remove/rename one at a
// time), and each task needs its own `todoist_task_id` slot once created
// (issue #6's storage-shape rationale).
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => interviewSessions.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    // "normal" | "medium" | "high" | "urgent" — app-validated, deliberately
    // not a Postgres enum type (issue #6), so the mapping to Todoist's
    // inverted 1-4 integer scale stays a plain app-level concern.
    priority: text('priority'),
    // Natural-language, Todoist-parsed due date; no separate due_date
    // column (issue #5's field mapping).
    dueString: text('due_string'),
    position: integer('position').notNull(),
    // Set once `create_todoist_tasks` creates the task in Todoist.
    todoistTaskId: text('todoist_task_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('tasks_session_id_idx').on(table.sessionId)],
)

export const interviewSessionsRelations = relations(interviewSessions, ({ one, many }) => ({
  user: one(user, {
    fields: [interviewSessions.userId],
    references: [user.id],
  }),
  messages: many(messages),
  tasks: many(tasks),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(interviewSessions, {
    fields: [messages.sessionId],
    references: [interviewSessions.id],
  }),
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
  session: one(interviewSessions, {
    fields: [tasks.sessionId],
    references: [interviewSessions.id],
  }),
}))
