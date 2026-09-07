// Tests for the Todoist token's at-rest encryption (issue #23, ADR-0002):
// Node's built-in crypto, AES-256-GCM, a random IV per write, stored as
// `base64(iv || authTag || ciphertext)`, with the key read from the
// TOKEN_ENCRYPTION_KEY env var.
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto'

import { afterEach, describe, expect, it } from 'vitest'

import { decryptToken, encryptToken, loadTokenEncryptionKey } from './token-crypto.ts'

const KEY = createHash('sha256').update('test-key-material').digest()
const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0'

const ENV_KEY = 'TOKEN_ENCRYPTION_KEY'

afterEach(() => {
  delete process.env[ENV_KEY]
})

function decode(payload: string): Buffer {
  const raw = Buffer.from(payload, 'base64')
  expect(raw.toString('base64')).toBe(payload)
  return raw
}

describe('encryptToken / decryptToken', () => {
  it('round-trips the plaintext token', () => {
    const payload = encryptToken(TOKEN, KEY)
    expect(payload).not.toContain(TOKEN)
    expect(decryptToken(payload, KEY)).toBe(TOKEN)
  })

  it('stores base64(iv || authTag || ciphertext) — 12-byte IV, 16-byte auth tag', () => {
    const raw = decode(encryptToken(TOKEN, KEY))
    expect(raw.length).toBe(12 + 16 + Buffer.byteLength(TOKEN, 'utf8'))

    const iv = raw.subarray(0, 12)
    const authTag = raw.subarray(12, 12 + 16)
    const ciphertext = raw.subarray(12 + 16)

    // Independent re-encryption of the same layout must decrypt back —
    // proves the layout is iv || authTag || ciphertext, not an internal
    // serialization only our own code could read.
    const reference = createCipheriv('aes-256-gcm', KEY, iv)
    const sealed = Buffer.concat([reference.update(TOKEN, 'utf8'), reference.final()])
    expect(reference.getAuthTag().equals(authTag)).toBe(true)
    expect(sealed.equals(ciphertext)).toBe(true)

    const opener = createDecipheriv('aes-256-gcm', KEY, iv)
    opener.setAuthTag(authTag)
    expect(
      Buffer.concat([opener.update(ciphertext), opener.final()]).toString('utf8'),
    ).toBe(TOKEN)
  })

  it('uses a fresh IV per write, so the same token encrypts differently every time', () => {
    const first = decode(encryptToken(TOKEN, KEY))
    const second = decode(encryptToken(TOKEN, KEY))
    expect(first.equals(second)).toBe(false)
    expect(first.subarray(0, 12).equals(second.subarray(0, 12))).toBe(false)
  })

  it('refuses to decrypt tampered ciphertext', () => {
    const raw = decode(encryptToken(TOKEN, KEY))
    raw[raw.length - 1] ^= 0x01
    expect(() => decryptToken(raw.toString('base64'), KEY)).toThrow()
  })

  it('refuses to decrypt with the wrong key', () => {
    const payload = encryptToken(TOKEN, KEY)
    const otherKey = createHash('sha256').update('unrelated').digest()
    expect(() => decryptToken(payload, otherKey)).toThrow()
  })
})

describe('loadTokenEncryptionKey', () => {
  it('derives a 32-byte AES-256 key from the env var', () => {
    process.env[ENV_KEY] = 'some-secret-from-the-environment'
    expect(loadTokenEncryptionKey().length).toBe(32)
  })

  it('derives the same key for the same env value', () => {
    process.env[ENV_KEY] = 'some-secret-from-the-environment'
    expect(loadTokenEncryptionKey().equals(loadTokenEncryptionKey())).toBe(true)
  })

  it('throws when the env var is unset', () => {
    expect(() => loadTokenEncryptionKey()).toThrowError(/TOKEN_ENCRYPTION_KEY/)
  })

  it('throws when the env var is empty', () => {
    process.env[ENV_KEY] = '   '
    expect(() => loadTokenEncryptionKey()).toThrowError(/TOKEN_ENCRYPTION_KEY/)
  })

  it('matches a plain sha256 derivation of the env value', () => {
    process.env[ENV_KEY] = 'some-secret-from-the-environment'
    expect(
      loadTokenEncryptionKey().equals(
        createHash('sha256').update('some-secret-from-the-environment').digest(),
      ),
    ).toBe(true)
  })
})
