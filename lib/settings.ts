import { prisma } from '@/lib/db'

export const defaultFinderSettings = {
  defaultScanMode: 'DEEP' as const,
  maxPages: 80,
  requestTimeoutMs: 15_000,
  concurrency: 6,
  retryCount: 2,
}

export const defaultPaymentSettings = {
  expirationMinutes: 60,
  cryptocurrencies: {} as Record<
    string,
    { enabled: boolean; address: string; amounts?: Record<string, number> }
  >,
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } })
  return setting ? (setting.value as T) : fallback
}

export async function getFinderSettings() {
  return getSetting('finder', defaultFinderSettings)
}

export async function getPaymentSettings() {
  return getSetting('payments', defaultPaymentSettings)
}
