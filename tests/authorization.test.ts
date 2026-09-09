import { UserRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getApiUser: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getApiUser: mocks.getApiUser }))

import { requireApiUser } from '@/lib/api'

describe('server-side authorization', () => {
  beforeEach(() => mocks.getApiUser.mockReset())

  it('rejects unauthenticated API calls', async () => {
    mocks.getApiUser.mockResolvedValue(null)
    await expect(requireApiUser()).rejects.toMatchObject({ status: 401 })
  })

  it('never permits a normal user through an admin guard', async () => {
    mocks.getApiUser.mockResolvedValue({ id: 'user-1', role: UserRole.USER })
    await expect(requireApiUser(UserRole.ADMIN)).rejects.toMatchObject({ status: 403 })
  })

  it('permits the configured role', async () => {
    const admin = { id: 'admin-1', role: UserRole.ADMIN }
    mocks.getApiUser.mockResolvedValue(admin)
    await expect(requireApiUser(UserRole.ADMIN)).resolves.toBe(admin)
  })
})
