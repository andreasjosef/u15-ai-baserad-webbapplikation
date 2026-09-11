// The Interview's single system prompt and its two model-facing tool
// definitions (`mark_checkpoint`, issue #24; `propose_task_breakdown`,
// issue #25). Authored with the writing-for-agents skill: positive
// phrasing over negation, leading words the model recruits priors for
// (thread, settled, ready, vague, concrete, drill), one sharp completion
// criterion for firing each tool — and no meta-concepts (checkpoint,
// phase, grilling, and — since issue #80 — the internal names for the
// prompt's decision-tree behaviors) leaking into anything the user could
// see. Only the prompt's external text is asserted here, never its
// internal structure — see interview-prompt.ts for what issue #80 added.
import { describe, expect, it } from 'vitest'

import {
  INTERVIEW_SYSTEM_PROMPT,
  MARK_CHECKPOINT_TOOL,
  PROPOSE_TASK_BREAKDOWN_TOOL,
} from './interview-prompt.ts'

describe('INTERVIEW_SYSTEM_PROMPT', () => {
  it('enforces one question at a time', () => {
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/one question/i)
  })

  it('keeps process jargon out of anything user-visible', () => {
    // The tool name itself appears exactly once (the firing instruction);
    // meta-concepts like grilling's vocabulary — and, since issue #80, the
    // internal names for the four decision-tree behaviors — never do, and
    // the transition after firing is explicitly in plain words.
    expect(INTERVIEW_SYSTEM_PROMPT.match(/mark_checkpoint/g)).toHaveLength(1)
    expect(INTERVIEW_SYSTEM_PROMPT).not.toMatch(
      /grilling|frontier|design tree|branch(es)?|prerequisite|dependenc(y|ies)|prune|pruning|backtrack/i,
    )
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/plain words|ordinary words|everyday words/i)
  })

  it('defers a question until whatever it depends on is settled', () => {
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/depends on a fact/i)
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/settle that fact first/i)
  })

  it('drops a step an earlier answer already ruled out, and says so in one short clause', () => {
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/rules out a step/i)
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/one short clause/i)
  })

  it('names simultaneous next steps and asks which to tackle first, re-offering until exhausted', () => {
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/name them in plain words/i)
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/which to tackle first/i)
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/offer the same choice again/i)
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/until only one thread in the group is left/i)
  })

  it('skips the named choice for trivial same-breath details', () => {
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/priority and its due date/i)
  })

  it('revisits an earlier step when a later answer contradicts it, scoped to the current steps only', () => {
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/contradicts something you already settled/i)
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/stays fixed for the rest of the conversation/i)
  })
})

describe('MARK_CHECKPOINT_TOOL', () => {
  it('exposes mark_checkpoint with a required project_summary string argument', () => {
    expect(MARK_CHECKPOINT_TOOL.function.name).toBe('mark_checkpoint')
    const parameters = MARK_CHECKPOINT_TOOL.function.parameters as unknown as {
      type: string
      required: string[]
      properties: Record<string, { type: string }>
    }
    expect(parameters.type).toBe('object')
    expect(parameters.required).toContain('project_summary')
    expect(parameters.properties.project_summary?.type).toBe('string')
  })
})

describe('PROPOSE_TASK_BREAKDOWN_TOOL', () => {
  it('exposes propose_task_breakdown with required project_title and tasks arguments', () => {
    expect(PROPOSE_TASK_BREAKDOWN_TOOL.function.name).toBe('propose_task_breakdown')
    const parameters = PROPOSE_TASK_BREAKDOWN_TOOL.function.parameters as unknown as {
      type: string
      required: string[]
      properties: Record<string, unknown>
    }
    expect(parameters.type).toBe('object')
    expect(parameters.required).toContain('project_title')
    expect(parameters.required).toContain('tasks')
    expect(parameters.properties.project_title).toMatchObject({ type: 'string' })
    expect(parameters.properties.tasks).toMatchObject({ type: 'array' })
  })

  it('offers each task with a title, optional extras, and the friendly priority enum', () => {
    const parameters = PROPOSE_TASK_BREAKDOWN_TOOL.function.parameters as unknown as {
      properties: {
        tasks: {
          items: {
            type: string
            required: string[]
            properties: Record<string, { type: string; enum?: string[] }>
          }
        }
      }
    }
    const item = parameters.properties.tasks.items
    expect(item.type).toBe('object')
    expect(item.required).toContain('title')
    expect(item.properties.title).toMatchObject({ type: 'string' })
    expect(item.properties.description).toMatchObject({ type: 'string' })
    expect(item.properties.due_string).toMatchObject({ type: 'string' })
    expect(item.properties.priority?.enum).toEqual(['normal', 'medium', 'high', 'urgent'])
  })
})
