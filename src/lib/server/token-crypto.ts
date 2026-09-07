// At-rest encryption for the Todoist personal API token (issue #23,
// ADR-0002): Node's built-in crypto — no pgcrypto, no KMS — AES-256-GCM
// with a fresh random IV per write, stored as
// `base64(iv || authTag || ciphertext)` in `user.todoistToken`.
//
// Server-only (both by the `server/` directory convention and because the
// key must never reach the client): encryption happens when settings are
// saved; decryption happens only at the point of calling the Todoist API.
// The stored value is never sent back to the client — the settings UI
// shows only whether a token exists.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const IV_LENGTH = 12 // GCM's recommended IV size
const AUTH_TAG_LENGTH = 16

export const TOKEN_ENCRYPTION_KEY_ENV = 'TOKEN_ENCRYPTION_KEY'

// The env var holds a passphrase rather than raw key bytes (simplest thing
// to provision next to the project's other secrets), so it's stretched to
// the 32 bytes AES-256 needs with a sha256. Deterministic by design: the
// same env value must keep decrypting everything ever written with it.
export function loadTokenEncryptionKey(): Buffer {
  const secret = process.env[TOKEN_ENCRYPTION_KEY_ENV]
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error(
      `${TOKEN_ENCRYPTION_KEY_ENV} is not set — the Todoist token cannot be ` +
        'encrypted or decrypted without it (see .env.example).',
    )
  }
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptToken(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}

export function decryptToken(payload: string, key: Buffer): string {
  const raw = Buffer.from(payload, 'base64')
  const iv = raw.subarray(0, IV_LENGTH)
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  // GCM's auth tag makes any tampering or wrong key throw here — the
  // caller decides how to surface that (never to the user as plaintext).
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
