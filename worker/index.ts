import { Worker, type Job } from 'bullmq'
import { prisma } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { processDomainById } from '@/lib/finder/processor'
import { EMAIL_SCAN_QUEUE, getRedisConnection } from '@/lib/queue'
import { getFinderSettings } from '@/lib/settings'

type ScanData = { domainId: string }

async function sweepPlanExpirations() {
  const now = new Date()
  await prisma.payment.updateMany({
    where: { status: { in: ['PENDING', 'MORE_INFO_REQUIRED'] }, expiresAt: { lte: now } },
    data: { status: 'EXPIRED' },
  })
  const expired = await prisma.userPlan.findMany({
    where: { status: 'ACTIVE', expiresAt: { lte: now } },
  })
  for (const plan of expired) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.userPlan.updateMany({
        where: { id: plan.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      })
      if (!changed.count) return
      await tx.user.update({ where: { id: plan.userId }, data: { status: 'INACTIVE' } })
      await tx.notification.create({
        data: {
          userId: plan.userId,
          type: 'PLAN_EXPIRED',
          title: 'Plan expired',
          message: 'Your plan has expired. Contact admin to activate a new plan.',
        },
      })
    })
  }
}

async function main() {
  if (process.argv.includes('--check')) {
    getEnv()
    console.log('Worker modules and environment configuration are valid')
    await prisma.$disconnect()
    return
  }
  const settings = await getFinderSettings()
  const worker = new Worker<ScanData>(EMAIL_SCAN_QUEUE, (job: Job<ScanData>) => processDomainById(job.data.domainId, (job.attemptsMade || 0) + 1), {
    connection: getRedisConnection(),
    concurrency: settings.concurrency,
  })
  worker.on('completed', (job) => console.log(`Completed domain job ${job.id}`))
  worker.on('failed', (job, error) => console.error(`Domain job ${job?.id} failed: ${error.message}`))
  await sweepPlanExpirations()
  const sweepTimer = setInterval(() => void sweepPlanExpirations().catch(console.error), 60 * 60 * 1000)
  const close = async () => {
    clearInterval(sweepTimer)
    await worker.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', close)
  process.on('SIGTERM', close)
  console.log(`Ghost Mail Finder worker started with concurrency ${settings.concurrency}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
