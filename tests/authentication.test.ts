import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'
import { passwordSchema, registerSchema } from '@/lib/validation'

describe('authentication validation', () => {
  it('requires length, an uppercase letter, and a number', () => {
    expect(passwordSchema.safeParse('password').success).toBe(false)
    expect(passwordSchema.safeParse('Password').success).toBe(false)
    expect(passwordSchema.safeParse('Password1').success).toBe(true)
  })

  it('requires matching registration passwords', () => {
    expect(
      registerSchema.safeParse({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Different1',
      }).success,
    ).toBe(false)
  })

  it('hashes passwords with Argon2id', async () => {
    const hash = await hashPassword('Password1')
    expect(hash).not.toContain('Password1')
    expect(await verifyPassword(hash, 'Password1')).toBe(true)
    expect(await verifyPassword(hash, 'WrongPassword1')).toBe(false)
  })
})
