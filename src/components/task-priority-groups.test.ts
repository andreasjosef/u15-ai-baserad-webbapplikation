// Tests for the priority grouping module (issue #109) — the one place
// that decides what a priority means, visually and as a section order,
// shared by the Proposed-phase TaskReview and the Completed-screen
// receipt.
import { describe, expect, it } from 'vitest'

import type { TaskPriority } from '../lib/task-input.ts'

import {
  groupTasksByPriority,
  PRIORITY_GROUPS,
  PRIORITY_META,
  type Prioritised,
} from './task-priority-groups.ts'

function row(priority: TaskPriority, title: string): Prioritised & { title: string } {
  return { priority, title }
}

describe('PRIORITY_GROUPS', () => {
  it('orders sections urgent, high, medium, normal', () => {
    expect(PRIORITY_GROUPS).toEqual(['urgent', 'high', 'medium', 'normal'])
  })
})

describe('PRIORITY_META', () => {
  it('labels every priority with its display name', () => {
    expect(PRIORITY_META.normal.label).toBe('Normal')
    expect(PRIORITY_META.medium.label).toBe('Medium')
    expect(PRIORITY_META.high.label).toBe('High')
    expect(PRIORITY_META.urgent.label).toBe('Urgent')
  })

  it('maps Normal to gray and Medium to the primary purple', () => {
    expect(PRIORITY_META.normal.dot).toContain('bg-muted-foreground')
    expect(PRIORITY_META.medium.dot).toContain('bg-primary')
  })

  it('maps High to amber and Urgent to the destructive red', () => {
    expect(PRIORITY_META.high.dot).toContain('bg-amber-500')
    expect(PRIORITY_META.urgent.dot).toContain('bg-destructive')
  })
})

describe('groupTasksByPriority', () => {
  it('returns sections in the fixed Urgent→High→Medium→Normal order', () => {
    const groups = groupTasksByPriority([
      row('normal', 'a'),
      row('high', 'b'),
      row('medium', 'c'),
      row('urgent', 'd'),
    ])
    expect(groups.map((group) => group.priority)).toEqual(['urgent', 'high', 'medium', 'normal'])
  })

  it('omits sections with no tasks', () => {
    const groups = groupTasksByPriority([row('normal', 'a'), row('urgent', 'b')])
    expect(groups.map((group) => group.priority)).toEqual(['urgent', 'normal'])
  })

  it('keeps within-section order as given', () => {
    const groups = groupTasksByPriority([
      row('normal', 'first'),
      row('high', 'second'),
      row('normal', 'third'),
    ])
    const normal = groups.find((group) => group.priority === 'normal')
    expect(normal?.tasks.map((task) => task.title)).toEqual(['first', 'third'])
  })

  it('returns an empty array for no tasks', () => {
    expect(groupTasksByPriority([])).toEqual([])
  })
})
