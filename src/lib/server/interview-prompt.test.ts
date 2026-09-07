// The Interview's single system prompt and the `mark_checkpoint` tool
// definition (issue #24). Authored with the writing-for-agents skill:
// positive phrasing over negation, leading words the model recruits
// priors for (vague, concrete, drill), one sharp completion criterion
// for firing the tool — and no meta-concepts (checkpoint, phase,
// grilling) leaking into anything the user could see.
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
    // meta-concepts like grilling's vocabulary never do, and the
    // transition after firing is explicitly in plain words.
    expect(INTERVIEW_SYSTEM_PROMPT.match(/mark_checkpoint/g)).toHaveLength(1)
    expect(INTERVIEW_SYSTEM_PROMPT).not.toMatch(/grilling|frontier|design tree/i)
    expect(INTERVIEW_SYSTEM_PROMPT).toMatch(/plain words|ordinary words|everyday words/i)
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
