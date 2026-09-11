import { describe, expect, it } from 'vitest'

import { parseOpenRouterKey, parseTodoistToken } from './token-input.ts'

describe('parseTodoistToken', () => {
  it('accepts and trims a pasted token', () => {
    expect(parseTodoistToken({ token: '  a1b2c3d4  ' })).toEqual({
      ok: true,
      data: { token: 'a1b2c3d4' },
    })
  })

  it('accepts a bare string (form-less server re-validation)', () => {
    expect(parseTodoistToken('a1b2c3d4')).toEqual({
      ok: true,
      data: { token: 'a1b2c3d4' },
    })
  })

  it('rejects whitespace-only input', () => {
    expect(parseTodoistToken({ token: '   ' })).toEqual({
      ok: false,
      message: 'Paste your Todoist API token.',
    })
  })

  it('rejects missing and non-string input', () => {
    expect(parseTodoistToken(undefined).ok).toBe(false)
    expect(parseTodoistToken({}).ok).toBe(false)
    expect(parseTodoistToken(42).ok).toBe(false)
  })
})

describe('parseOpenRouterKey', () => {
  it('accepts and trims a pasted key', () => {
    expect(parseOpenRouterKey({ token: '  sk-or-v1-abc123  ' })).toEqual({
      ok: true,
      data: { token: 'sk-or-v1-abc123' },
    })
  })

  it('accepts a bare string (form-less server re-validation)', () => {
    expect(parseOpenRouterKey('sk-or-v1-abc123')).toEqual({
      ok: true,
      data: { token: 'sk-or-v1-abc123' },
    })
  })

  it('rejects whitespace-only input', () => {
    expect(parseOpenRouterKey({ token: '   ' })).toEqual({
      ok: false,
      message: 'Paste your OpenRouter API key.',
    })
  })

  it('rejects missing and non-string input', () => {
    expect(parseOpenRouterKey(undefined).ok).toBe(false)
    expect(parseOpenRouterKey({}).ok).toBe(false)
    expect(parseOpenRouterKey(42).ok).toBe(false)
  })
})
