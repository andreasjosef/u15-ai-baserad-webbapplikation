import { describe, expect, it } from 'vitest'

import { parseSignInCredentials, parseSignUpCredentials } from './auth-input.ts'

describe('parseSignInCredentials', () => {
  it('accepts and normalizes a well-formed email and a password', () => {
    const result = parseSignInCredentials({
      email: '  Person@Example.com ',
      password: 'correct horse battery staple',
    })
    expect(result).toEqual({
      ok: true,
      data: { email: 'person@example.com', password: 'correct horse battery staple' },
    })
  })

  it('rejects a blank email', () => {
    const result = parseSignInCredentials({ email: '   ', password: 'whatever-8+' })
    expect(result).toMatchObject({ ok: false })
  })

  it('rejects a malformed email', () => {
    const result = parseSignInCredentials({ email: 'not-an-email', password: 'whatever-8+' })
    expect(result).toMatchObject({ ok: false })
  })

  it('rejects a blank password', () => {
    const result = parseSignInCredentials({ email: 'person@example.com', password: '' })
    expect(result).toMatchObject({ ok: false })
  })

  it('rejects non-object input', () => {
    expect(parseSignInCredentials(null)).toMatchObject({ ok: false })
    expect(parseSignInCredentials('nope')).toMatchObject({ ok: false })
  })
})

describe('parseSignUpCredentials', () => {
  const valid = { name: ' Test User ', email: 'person@example.com', password: 'long-enough-pass' }

  it('accepts and normalizes name, email and password', () => {
    const result = parseSignUpCredentials(valid)
    expect(result).toEqual({
      ok: true,
      data: { name: 'Test User', email: 'person@example.com', password: 'long-enough-pass' },
    })
  })

  it('rejects a blank name', () => {
    const result = parseSignUpCredentials({ ...valid, name: '   ' })
    expect(result).toMatchObject({ ok: false })
  })

  it("rejects a password shorter than Better Auth's minimum of 8 characters", () => {
    const result = parseSignUpCredentials({ ...valid, password: 'short7' })
    expect(result).toMatchObject({ ok: false })
  })

  it('rejects a malformed email', () => {
    const result = parseSignUpCredentials({ ...valid, email: 'nope' })
    expect(result).toMatchObject({ ok: false })
  })

  it('rejects non-object input', () => {
    expect(parseSignUpCredentials(undefined)).toMatchObject({ ok: false })
  })
})
