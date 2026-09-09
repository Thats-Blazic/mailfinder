import { NextResponse } from 'next/server'
import { apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getPaymentSettings } from '@/lib/settings'

export async function GET() {
  try {
    await requireApiUser()
    const [plans, paymentSettings] = await Promise.all([
      prisma.plan.findMany({ where: { active: true }, orderBy: { price: 'asc' } }),
      getPaymentSettings(),
    ])
    const cryptocurrencies = Object.entries(paymentSettings.cryptocurrencies)
      .filter(([, config]) => config.enabled && config.address)
      .map(([symbol]) => symbol)
    return NextResponse.json({ plans, cryptocurrencies })
  } catch (error) {
    return apiError(error)
  }
}
