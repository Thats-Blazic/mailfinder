import { UserPlanStatus } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { isPlanUsable, quotaForPlanName } from '@/lib/plans'

describe('plan expiration', () => {
  const now = new Date('2026-09-09T00:00:00Z')

  it('allows only an active, unexpired plan', () => {
    expect(
      isPlanUsable({ status: UserPlanStatus.ACTIVE, expiresAt: new Date('2026-10-09') }, now),
    ).toBe(true)
    expect(
      isPlanUsable({ status: UserPlanStatus.ACTIVE, expiresAt: new Date('2026-09-08') }, now),
    ).toBe(false)
    expect(
      isPlanUsable({ status: UserPlanStatus.REVOKED, expiresAt: new Date('2026-10-09') }, now),
    ).toBe(false)
  })
})

describe('search quotas', () => {
  it('limits Starter to 30 sites every 30 minutes', () => {
    expect(quotaForPlanName('STARTER')).toMatchObject({
      maxBatch: 30,
      windowMinutes: 30,
      windowLimit: 30,
    })
  })

  it('lets Pro and Business scan 800+ sites with no waiting period', () => {
    expect(quotaForPlanName('PRO').maxBatch).toBeGreaterThanOrEqual(800)
    expect(quotaForPlanName('PRO').windowMinutes).toBeNull()
    expect(quotaForPlanName('BUSINESS').maxBatch).toBeGreaterThanOrEqual(800)
    expect(quotaForPlanName('BUSINESS').windowMinutes).toBeNull()
  })
})
