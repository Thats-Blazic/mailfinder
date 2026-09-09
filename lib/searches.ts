import { ScanMode } from '@prisma/client'
import { ApiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { processDomainInput } from '@/lib/finder/domains'
import { ensureSearchRunning } from '@/lib/finder/processor'
import { quotaForPlanName } from '@/lib/plans'
import { getScanQueue, isRedisReady } from '@/lib/queue'
import { getFinderSettings, getSetting } from '@/lib/settings'

export async function createSearch(input: {
  userId: string
  name: string
  mode: ScanMode
  domains: string[]
}) {
  const parsed = processDomainInput(input.domains)
  if (!parsed.domains.length) throw new ApiError(400, 'No valid domains were provided')
  const [settings, system] = await Promise.all([
    getFinderSettings(),
    getSetting('system', { maintenanceMode: false, searchQueueEnabled: true }),
  ])
  if (system.maintenanceMode) throw new ApiError(503, 'Ghost Mail Finder is in maintenance mode')

  const search = await prisma.$transaction(async (tx) => {
    const activePlan = await tx.userPlan.findFirst({
      where: { userId: input.userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    })
    if (!activePlan) throw new ApiError(403, 'Your account does not have an active plan')
    const user = await tx.user.findUnique({ where: { id: input.userId } })
    if (!user || user.status !== 'ACTIVE') throw new ApiError(403, 'Your account is not active')

    const quota = quotaForPlanName(activePlan.plan.name)
    if (parsed.domains.length > quota.maxBatch) {
      throw new ApiError(400, `${activePlan.plan.name} can scan up to ${quota.maxBatch} sites at once`)
    }
    if (quota.windowMinutes && quota.windowLimit) {
      const since = new Date(Date.now() - quota.windowMinutes * 60_000)
      const used = await tx.search.aggregate({
        where: { userId: input.userId, createdAt: { gte: since }, status: { not: 'CANCELLED' } },
        _sum: { domainCount: true },
      })
      const already = used._sum.domainCount || 0
      if (already + parsed.domains.length > quota.windowLimit) {
        throw new ApiError(
          429,
          `${activePlan.plan.name} allows ${quota.windowLimit} sites every ${quota.windowMinutes} minutes. You already used ${already}.`,
        )
      }
    }

    const created = await tx.search.create({
      data: {
        userId: input.userId,
        name: input.name,
        mode: input.mode,
        domainCount: parsed.domains.length,
        creditsCharged: 0,
        domains: {
          create: parsed.domains.map((hostname) => ({
            hostname,
            scanJob: { create: {} },
          })),
        },
      },
      include: { domains: { include: { scanJob: true } } },
    })
    await tx.auditLog.create({
      data: {
        action: 'SEARCH_CREATED',
        targetType: 'Search',
        targetId: created.id,
        metadata: { userId: input.userId, domains: parsed.domains.length, mode: input.mode, plan: activePlan.plan.name },
      },
    })
    return created
  })

  let queued = false
  if (system.searchQueueEnabled && (await isRedisReady())) {
    try {
      const jobs = await getScanQueue().addBulk(
        search.domains.map((domain) => ({
          name: 'scan-domain',
          data: { domainId: domain.id },
          opts: {
            jobId: domain.id,
            attempts: settings.retryCount + 1,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          },
        })),
      )
      await prisma.$transaction(
        search.domains.map((domain, index) =>
          prisma.scanJob.update({
            where: { domainId: domain.id },
            data: { queueJobId: jobs[index]?.id },
          }),
        ),
      )
      queued = true
    } catch {
      queued = false
    }
  }

  if (!queued) ensureSearchRunning(search.id)

  return { search, input: parsed }
}
