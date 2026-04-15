import crypto from 'crypto'

/**
 * AES-256-GCM encryption/decryption for storing sensitive data (access tokens)
 * Uses a key from ENCRYPTION_KEY environment variable
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 16
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derive a key from the encryption key and salt using PBKDF2
 */
function deriveKey(encryptionKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(encryptionKey, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Base64-encoded string containing IV, salt, ciphertext, and auth tag
 */
export function encrypt(plaintext: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(encryptionKey, salt)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let ciphertext = cipher.update(plaintext, 'utf8', 'binary')
  ciphertext += cipher.final('binary')
  const authTag = cipher.getAuthTag()

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, Buffer.from(ciphertext, 'binary')])
  return combined.toString('base64')
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param ciphertext - Base64-encoded string from encrypt()
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  const combined = Buffer.from(ciphertext, 'base64')

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

  const key = deriveKey(encryptionKey, salt)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const plaintext = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')

  return plaintext
}
