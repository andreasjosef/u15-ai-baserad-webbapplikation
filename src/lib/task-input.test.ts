// Tests for the Task Breakdown's shared validation (issue #25) — the
// friendly priority enum plus the parsers behind the model's
// `propose_task_breakdown` call and the review table's edits. Same
// function on both ends (model args / server-function validator), so
// both ends agree on what's valid.
import { describe, expect, it } from 'vitest'

import {
  TASK_PRIORITIES,
  parseProposedBreakdown,
  parseTaskEdit,
  toTaskPriority,
} from './task-input.ts'

describe('TASK_PRIORITIES', () => {
  it('uses the friendly enum, not Todoist\'s inverted integers', () => {
    expect(TASK_PRIORITIES).toEqual(['normal', 'medium', 'high', 'urgent'])
  })
})

describe('toTaskPriority', () => {
  it('keeps a stored friendly priority as-is', () => {
    expect(toTaskPriority('urgent')).toBe('urgent')
  })

  it('falls back to normal for anything the app never wrote', () => {
    expect(toTaskPriority(undefined)).toBe('normal')
    expect(toTaskPriority(2)).toBe('normal')
    expect(toTaskPriority('asap')).toBe('normal')
  })
})

describe('parseProposedBreakdown', () => {
  it('accepts a project title and a list of tasks', () => {
    const result = parseProposedBreakdown({
      project_title: 'Garage cleanup',
      tasks: [
        { title: 'Clear out old boxes', priority: 'high', due_string: 'this weekend' },
        { title: 'Take donations to the tip', description: 'The green bags' },
      ],
    })
    expect(result).toEqual({
      ok: true,
      data: {
        projectTitle: 'Garage cleanup',
        tasks: [
          { title: 'Clear out old boxes', description: null, priority: 'high', dueString: 'this weekend' },
          { title: 'Take donations to the tip', description: 'The green bags', priority: 'normal', dueString: null },
        ],
      },
    })
  })

  it('rejects a missing or empty project_title', () => {
    expect(parseProposedBreakdown({ tasks: [{ title: 'a' }] }).ok).toBe(false)
    expect(parseProposedBreakdown({ project_title: '   ', tasks: [{ title: 'a' }] }).ok).toBe(false)
    expect(parseProposedBreakdown(null).ok).toBe(false)
  })

  it('rejects an empty task list', () => {
    expect(parseProposedBreakdown({ project_title: 'Garage', tasks: [] }).ok).toBe(false)
    expect(parseProposedBreakdown({ project_title: 'Garage' }).ok).toBe(false)
  })

  it('rejects a task without a title', () => {
    const result = parseProposedBreakdown({ project_title: 'Garage', tasks: [{ description: 'x' }] })
    expect(result.ok).toBe(false)
  })

  it('rejects a task with a priority outside the friendly enum', () => {
    const result = parseProposedBreakdown({
      project_title: 'Garage',
      tasks: [{ title: 'a', priority: 2 }],
    })
    expect(result.ok).toBe(false)
  })
})

describe('parseTaskEdit', () => {
  it('accepts a full row edit with trimmed fields', () => {
    const result = parseTaskEdit({
      title: '  Clear out old boxes  ',
      description: '  The green bags  ',
      priority: 'urgent',
      dueString: '  Saturday  ',
    })
    expect(result).toEqual({
      ok: true,
      data: {
        title: 'Clear out old boxes',
        description: 'The green bags',
        priority: 'urgent',
        dueString: 'Saturday',
      },
    })
  })

  it('allows clearing the optional fields with empty strings', () => {
    const result = parseTaskEdit({ title: 'a', description: '', priority: 'normal', dueString: '' })
    expect(result).toEqual({
      ok: true,
      data: { title: 'a', description: null, priority: 'normal', dueString: null },
    })
  })

  it('rejects a missing or empty title', () => {
    expect(parseTaskEdit({ priority: 'normal' }).ok).toBe(false)
    expect(parseTaskEdit({ title: '   ', priority: 'normal' }).ok).toBe(false)
  })

  it('rejects a priority outside the friendly enum', () => {
    expect(parseTaskEdit({ title: 'a', priority: 'asap' }).ok).toBe(false)
    expect(parseTaskEdit({ title: 'a', priority: 1 }).ok).toBe(false)
  })

  it('defaults the priority to normal when omitted', () => {
    const result = parseTaskEdit({ title: 'a' })
    expect(result).toEqual({
      ok: true,
      data: { title: 'a', description: null, priority: 'normal', dueString: null },
    })
  })
})
