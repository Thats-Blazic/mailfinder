import { UserPlanStatus } from '@prisma/client'

export function isPlanUsable(
  plan: { status: UserPlanStatus; expiresAt: Date } | null | undefined,
  now = new Date(),
) {
  return Boolean(plan && plan.status === UserPlanStatus.ACTIVE && plan.expiresAt.getTime() > now.getTime())
}

export type SearchQuota = {
  key: 'STARTER' | 'PRO' | 'BUSINESS' | 'UNKNOWN'
  maxBatch: number
  windowMinutes: number | null
  windowLimit: number | null
  maxPages: number
  label: string
}

export function quotaForPlanName(name?: string | null): SearchQuota {
  const key = (name || '').trim().toUpperCase()
  if (key === 'PRO') {
    return {
      key: 'PRO',
      maxBatch: 1000,
      windowMinutes: null,
      windowLimit: null,
      maxPages: 140,
      label: 'Up to 1,000 sites per search, no waiting period',
    }
  }
  if (key === 'BUSINESS') {
    return {
      key: 'BUSINESS',
      maxBatch: 1000,
      windowMinutes: null,
      windowLimit: null,
      maxPages: 200,
      label: 'Up to 1,000 sites per search, no waiting period',
    }
  }
  return {
    key: 'STARTER',
    maxBatch: 30,
    windowMinutes: 30,
    windowLimit: 30,
    maxPages: 80,
    label: '30 sites every 30 minutes',
  }
}
