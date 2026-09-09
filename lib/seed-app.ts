import type { PrismaClient } from '@prisma/client'
import { hashPassword } from './password'
import { passwordSchema } from './validation'

export async function seedApp(prisma: PrismaClient) {
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase()
  const candidate = process.env.ADMIN_PASSWORD || 'Admin1234'
  const password = passwordSchema.safeParse(candidate).success ? candidate : 'Admin1234'

  const passwordHash = await hashPassword(password)
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: process.env.ADMIN_NAME || 'Main Administrator',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    create: {
      name: process.env.ADMIN_NAME || 'Main Administrator',
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  await prisma.user.updateMany({
    where: { role: 'ADMIN', id: { not: admin.id } },
    data: { role: 'USER' },
  })

  const plans = [
    {
      name: 'STARTER',
      description: '30 websites every 30 minutes. Deep public-page crawl for focused outreach.',
      price: 49,
      credits: 1,
      durationDays: 30,
      cryptoPrice: { BTC: 0.0005, ETH: 0.02, SOL: 0.35 },
    },
    {
      name: 'PRO',
      description: 'Scan up to 1,000 websites at once with no waiting period.',
      price: 149,
      credits: 1,
      durationDays: 30,
      cryptoPrice: { BTC: 0.0015, ETH: 0.06, SOL: 1.05 },
    },
    {
      name: 'BUSINESS',
      description: 'Highest coverage. Up to 1,000 websites at once, unlimited frequency, deepest crawl.',
      price: 399,
      credits: 1,
      durationDays: 30,
      cryptoPrice: { BTC: 0.004, ETH: 0.16, SOL: 2.85 },
    },
  ]
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: { ...plan, currency: 'USD' },
    })
  }

  const wallets: Record<string, string> = {
    BTC: process.env.BTC_ADDRESS || 'bc1qhd0aau0u8xsrnxdxmq7ta7950y8tdgyksr655j',
    SOL: process.env.SOL_ADDRESS || '7L97rEXcMwPxAzZjwrFYDgpuu6mM4MEBYJ4sgHbmgv5r',
    ETH: process.env.ETH_ADDRESS || '0xb9651ed7618F535D854667e5fe71daf836A2dEAE',
  }
  const cryptocurrencies = Object.fromEntries(
    ['BTC', 'SOL', 'ETH'].map((symbol) => [
      symbol,
      { enabled: Boolean(wallets[symbol]), address: wallets[symbol] },
    ]),
  )

  const settings = [
    { key: 'mainAdminUserId', value: admin.id },
    {
      key: 'general',
      value: { applicationName: 'Ghost Mail Finder', supportEmail: 'support@example.com' },
    },
    {
      key: 'finder',
      value: {
        defaultScanMode: 'DEEP',
        maxPages: 80,
        requestTimeoutMs: 15_000,
        concurrency: 6,
        retryCount: 2,
      },
    },
    { key: 'payments', value: { expirationMinutes: 60, cryptocurrencies } },
    {
      key: 'system',
      value: {
        maintenanceMode: false,
        registrationEnabled: true,
        searchQueueEnabled: true,
        notificationsEnabled: true,
      },
    },
  ]
  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    })
  }

  const business = await prisma.plan.findUnique({ where: { name: 'BUSINESS' } })
  const adminPlan = await prisma.userPlan.findFirst({
    where: { userId: admin.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
  })
  if (business && !adminPlan) {
    await prisma.userPlan.create({
      data: {
        userId: admin.id,
        planId: business.id,
        creditsGranted: 0,
        expiresAt: new Date(Date.now() + 365 * 86_400_000),
        assignedById: admin.id,
      },
    })
  }
}
