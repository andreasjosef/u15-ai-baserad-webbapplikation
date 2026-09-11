import { describe, expect, it } from 'vitest'

import { parseInterviewMessage } from './interview-input.ts'

describe('parseInterviewMessage', () => {
  it('accepts a vague idea and trims it', () => {
    expect(parseInterviewMessage({ message: '  I should sort out the garage ' })).toEqual({
      ok: true,
      data: { message: 'I should sort out the garage' },
    })
  })

  it('accepts a bare string (FormData-free callers)', () => {
    expect(parseInterviewMessage('sort the garage')).toEqual({
      ok: true,
      data: { message: 'sort the garage' },
    })
  })

  it('rejects whitespace-only input', () => {
    expect(parseInterviewMessage({ message: '   ' }).ok).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(parseInterviewMessage({ message: 42 }).ok).toBe(false)
    expect(parseInterviewMessage(null).ok).toBe(false)
  })

  it('rejects over-long input', () => {
    expect(parseInterviewMessage({ message: 'a'.repeat(2001) }).ok).toBe(false)
  })
})
