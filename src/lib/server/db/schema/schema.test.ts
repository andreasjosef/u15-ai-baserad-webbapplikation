// Runs against a real (test) Postgres database, not a mock — per the root
// spec's Testing Decisions, the Drizzle schema and its migration history
// are themselves part of what's under test here. Point DATABASE_URL at a
// disposable database; every row this file creates is cleaned up in
// `afterAll` via cascade delete from `user`, but nothing here is safe to
// run against a database you care about.
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { db } from '../client.ts'
import { decryptToken, encryptToken, loadTokenEncryptionKey } from '../../token-crypto.ts'
import * as schema from './index.ts'

const createdUserIds: Array<string> = []

async function insertTestUser() {
  const [testUser] = await db
    .insert(schema.user)
    .values({
      id: randomUUID(),
      name: 'Test User',
      email: `test-${randomUUID()}@example.com`,
    })
    .returning()
  createdUserIds.push(testUser!.id)
  return testUser!
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' })
})

afterAll(async () => {
  // Cascades to interview_sessions -> messages/tasks (see the FK ON DELETE
  // CASCADE asserted by the test below), so this alone cleans up everything
  // this file created.
  if (createdUserIds.length > 0) {
    await db.delete(schema.user).where(inArray(schema.user.id, createdUserIds))
  }
})

describe('user', () => {
  it('stores both encrypted credential columns as nullable payloads, clearable back to the shared default (ADR-0002, issue #136)', async () => {
    const testUser = await insertTestUser()

    // Defining: neither credential saved yet — the account runs on the
    // shared defaults until something is pasted in Settings.
    expect(testUser.todoistToken).toBeNull()
    expect(testUser.openrouterApiKey).toBeNull()

    // The columns hold whatever the token-crypto helpers write — opaque
    // base64(iv || authTag || ciphertext) payloads, never plaintext.
    await db
      .update(schema.user)
      .set({
        todoistToken: encryptToken('todoist-plaintext', loadTokenEncryptionKey()),
        openrouterApiKey: encryptToken('sk-or-v1-openrouter-plaintext', loadTokenEncryptionKey()),
      })
      .where(eq(schema.user.id, testUser.id))
    const [saved] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, testUser.id))

    expect(saved!.todoistToken).not.toBeNull()
    expect(decryptToken(saved!.todoistToken!, loadTokenEncryptionKey())).toBe('todoist-plaintext')
    expect(saved!.openrouterApiKey).not.toBeNull()
    expect(saved!.openrouterApiKey).not.toContain('openrouter-plaintext')
    expect(decryptToken(saved!.openrouterApiKey!, loadTokenEncryptionKey())).toBe(
      'sk-or-v1-openrouter-plaintext',
    )

    // Clearing reverts the account to the shared default: the column goes
    // back to null (the row itself survives).
    await db
      .update(schema.user)
      .set({ openrouterApiKey: null })
      .where(eq(schema.user.id, testUser.id))
    const [cleared] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, testUser.id))
    expect(cleared!.todoistToken).not.toBeNull()
    expect(cleared!.openrouterApiKey).toBeNull()
  })
})

describe('interview_sessions / messages / tasks', () => {
  it('persists a full Interview transcript and its resulting Task Breakdown', async () => {
    const testUser = await insertTestUser()

    const [session] = await db
      .insert(schema.interviewSessions)
      .values({ userId: testUser.id })
      .returning()

    // Defining: no mark_checkpoint message yet, nothing cached.
    expect(session!.projectSummary).toBeNull()
    expect(session!.projectTitle).toBeNull()
    expect(session!.todoistProjectId).toBeNull()

    // mark_checkpoint fires — Defining -> Drilling (CONTEXT.md's Phase entry).
    await db.insert(schema.messages).values({
      sessionId: session!.id,
      role: 'assistant',
      toolName: 'mark_checkpoint',
      toolArgs: { project_summary: 'Sort out the garage' },
    })
    await db
      .update(schema.interviewSessions)
      .set({ projectSummary: 'Sort out the garage' })
      .where(eq(schema.interviewSessions.id, session!.id))

    // propose_task_breakdown fires — Drilling -> Proposed.
    await db.insert(schema.messages).values({
      sessionId: session!.id,
      role: 'assistant',
      toolName: 'propose_task_breakdown',
      toolArgs: {
        project_title: 'Garage cleanup',
        tasks: [{ title: 'Clear out old boxes' }],
      },
    })
    const [task] = await db
      .insert(schema.tasks)
      .values({
        sessionId: session!.id,
        title: 'Clear out old boxes',
        priority: 'high',
        dueString: 'this weekend',
        position: 0,
      })
      .returning()

    const transcript = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.sessionId, session!.id))
      .orderBy(schema.messages.createdAt)

    expect(transcript.map((message) => message.toolName)).toEqual([
      'mark_checkpoint',
      'propose_task_breakdown',
    ])

    // Not yet created in Todoist — Phase stays Proposed until confirmed.
    expect(task!.todoistTaskId).toBeNull()
    expect(task!.position).toBe(0)
  })

  it('cascades delete from user through interview_sessions to messages and tasks', async () => {
    const testUser = await insertTestUser()
    const [session] = await db
      .insert(schema.interviewSessions)
      .values({ userId: testUser.id })
      .returning()
    await db.insert(schema.messages).values({
      sessionId: session!.id,
      role: 'user',
      content: 'I should sort out the garage',
    })
    await db.insert(schema.tasks).values({
      sessionId: session!.id,
      title: 'Clear out old boxes',
      position: 0,
    })

    await db.delete(schema.user).where(eq(schema.user.id, testUser.id))

    const remainingSessions = await db
      .select()
      .from(schema.interviewSessions)
      .where(eq(schema.interviewSessions.userId, testUser.id))
    const remainingMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.sessionId, session!.id))
    const remainingTasks = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.sessionId, session!.id))

    expect(remainingSessions).toHaveLength(0)
    expect(remainingMessages).toHaveLength(0)
    expect(remainingTasks).toHaveLength(0)
  })

  it("rejects a second user with the same email, matching Better Auth's own uniqueness expectation", async () => {
    const email = `dup-${randomUUID()}@example.com`
    const [first] = await db
      .insert(schema.user)
      .values({ id: randomUUID(), name: 'First', email })
      .returning()
    createdUserIds.push(first!.id)

    await expect(
      db.insert(schema.user).values({ id: randomUUID(), name: 'Second', email }),
    ).rejects.toThrow()
  })
})
