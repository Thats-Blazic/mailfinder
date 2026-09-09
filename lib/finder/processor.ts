import { prisma } from '@/lib/db'
import { crawlDomain } from '@/lib/finder/crawler'
import { quotaForPlanName } from '@/lib/plans'

export async function finalizeSearch(searchId: string) {
  await prisma.$transaction(async (tx) => {
    const [search, remaining, completed] = await Promise.all([
      tx.search.findUnique({ where: { id: searchId } }),
      tx.domain.count({ where: { searchId, status: { in: ['QUEUED', 'PROCESSING'] } } }),
      tx.domain.count({ where: { searchId, status: 'COMPLETED' } }),
    ])
    if (!search || remaining > 0 || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(search.status)) return

    const status = completed > 0 ? 'COMPLETED' : 'FAILED'
    const finalized = await tx.search.updateMany({
      where: { id: search.id, status: { in: ['QUEUED', 'PROCESSING'] } },
      data: { status, completedAt: new Date() },
    })
    if (!finalized.count) return
    await tx.notification.create({
      data: {
        userId: search.userId,
        type: status === 'COMPLETED' ? 'SEARCH_COMPLETED' : 'SEARCH_FAILED',
        title: status === 'COMPLETED' ? 'Search completed' : 'Search failed',
        message:
          status === 'COMPLETED'
            ? `${search.name} finished. Public emails are ready.`
            : `${search.name} could not scan any domains.`,
      },
    })
  })
}

export async function processDomainById(domainId: string, attempt = 1) {
  const record = await prisma.domain.findUnique({
    where: { id: domainId },
    include: { search: { include: { user: { include: { plans: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1 } } } } }, scanJob: true },
  })
  if (!record || record.status === 'COMPLETED' || record.search.status === 'CANCELLED') return

  const claimed = await prisma.$transaction(async (tx) => {
    const search = await tx.search.updateMany({
      where: { id: record.searchId, status: { in: ['QUEUED', 'PROCESSING'] } },
      data: { status: 'PROCESSING', startedAt: record.search.startedAt || new Date() },
    })
    if (!search.count) return false
    await tx.domain.update({ where: { id: record.id }, data: { status: 'PROCESSING', error: null } })
    if (record.scanJob) {
      await tx.scanJob.update({
        where: { domainId: record.id },
        data: { status: 'ACTIVE', startedAt: new Date(), attempts: { increment: 1 } },
      })
    }
    return true
  })
  if (!claimed) return

  const quota = quotaForPlanName(record.search.user.plans[0]?.plan.name)
  try {
    const crawled = await crawlDomain(record.hostname, {
      maxPages: quota.maxPages,
      timeoutMs: 6_000,
      mode: record.search.mode === 'FAST' ? 'FAST' : record.search.mode === 'STANDARD' ? 'STANDARD' : 'DEEP',
    })

    await prisma.$transaction(async (tx) => {
      const currentSearch = await tx.search.findUnique({ where: { id: record.searchId }, select: { status: true } })
      if (currentSearch?.status === 'CANCELLED') return
      if (crawled.results.length) {
        for (const result of crawled.results) {
          await tx.emailResult.upsert({
            where: {
              domainId_email_sourceUrl: {
                domainId: record.id,
                email: result.email,
                sourceUrl: result.sourceUrl,
              },
            },
            update: {
              emailType: result.emailType,
              sourceType: result.sourceType,
              confidence: result.confidence,
            },
            create: {
              domainId: record.id,
              email: result.email,
              emailType: result.emailType,
              sourceUrl: result.sourceUrl,
              sourceType: result.sourceType,
              confidence: result.confidence,
            },
          })
        }
      }
      await tx.domain.update({
        where: { id: record.id },
        data: { status: 'COMPLETED', pagesScanned: crawled.pagesScanned },
      })
      if (record.scanJob) {
        await tx.scanJob.update({
          where: { domainId: record.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
      }
      await tx.search.update({
        where: { id: record.searchId },
        data: {
          processedCount: { increment: 1 },
          emailsFound: { increment: crawled.results.length },
        },
      })
    })
    await finalizeSearch(record.searchId)
    return { emailsFound: crawled.results.length }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown crawler error'
    const finalAttempt = attempt >= 2
    await prisma.$transaction([
      prisma.domain.update({
        where: { id: record.id },
        data: { status: finalAttempt ? 'FAILED' : 'QUEUED', error: message },
      }),
      ...(record.scanJob
        ? [
            prisma.scanJob.update({
              where: { domainId: record.id },
              data: {
                status: finalAttempt ? 'FAILED' : 'QUEUED',
                lastError: message,
                completedAt: finalAttempt ? new Date() : null,
              },
            }),
          ]
        : []),
      ...(finalAttempt
        ? [prisma.search.update({ where: { id: record.searchId }, data: { processedCount: { increment: 1 } } })]
        : []),
    ])
    if (finalAttempt) await finalizeSearch(record.searchId)
    else await processDomainById(domainId, attempt + 1)
  }
}

const runningSearches = new Set<string>()

export async function runSearchLocally(searchId: string, concurrency = 3) {
  const domains = await prisma.domain.findMany({
    where: { searchId, status: 'QUEUED' },
    select: { id: true, hostname: true },
  })
  console.log(`Ghost Mail Finder: ${domains.length} queued sites for ${searchId}`)
  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency)
    console.log(`Ghost Mail Finder: scanning ${batch.map((item) => item.hostname).join(', ')}`)
    await Promise.all(batch.map((domain) => processDomainById(domain.id)))
  }
}

export async function ensureSearchRunning(searchId: string) {
  if (runningSearches.has(searchId)) return
  const search = await prisma.search.findUnique({
    where: { id: searchId },
    select: { status: true },
  })
  if (!search || !['QUEUED', 'PROCESSING'].includes(search.status)) return

  runningSearches.add(searchId)
  void (async () => {
    try {
      await runSearchLocally(searchId)
    } catch (error) {
      console.error('Local search failed', error)
    } finally {
      runningSearches.delete(searchId)
    }
  })()
}
