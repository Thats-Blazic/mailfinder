import { promisify } from 'node:util'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'

const scrypt = promisify(scryptCallback)
const SCRYPT_PREFIX = 'scrypt1$'

async function hashWithScrypt(password: string) {
  const salt = randomBytes(16)
  const key = (await scrypt(password, salt, 32)) as Buffer
  return `${SCRYPT_PREFIX}${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function hashPassword(password: string) {
  try {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    })
  } catch (error) {
    console.warn('argon2 unavailable, using scrypt', error)
    return hashWithScrypt(password)
  }
}

export async function verifyPassword(hash: string, password: string) {
  try {
    if (hash.startsWith(SCRYPT_PREFIX)) {
      const [, salt, expected] = hash.split('$')
      if (!salt || !expected) return false
      const key = (await scrypt(password, Buffer.from(salt, 'base64url'), 32)) as Buffer
      const actual = Buffer.from(expected, 'base64url')
      return key.length === actual.length && timingSafeEqual(key, actual)
    }
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}
