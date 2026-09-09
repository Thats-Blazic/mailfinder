import { Prisma, UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, clientIp, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { defaultFinderSettings, defaultPaymentSettings } from '@/lib/settings'

const sectionSchema = z.enum(['general', 'finder', 'payments', 'system'])
const paramsSchema = z.object({ section: sectionSchema })

const generalSchema = z
  .object({
    applicationName: z.string().trim().min(1).max(100),
    supportEmail: z.string().trim().email().max(254),
  })
  .strict()

const finderSchema = z
  .object({
    defaultScanMode: z.enum(['FAST', 'STANDARD', 'DEEP']),
    maxPages: z.coerce.number().int().min(1).max(100),
    requestTimeoutMs: z.coerce.number().int().min(1000).max(120_000),
    concurrency: z.coerce.number().int().min(1).max(100),
    retryCount: z.coerce.number().int().min(0).max(10),
  })
  .strict()

const walletSchema = z
  .object({
    enabled: z.boolean(),
    address: z.string().trim().max(256),
    amounts: z.record(z.string().max(50), z.number().positive()).optional(),
  })
  .strict()

const paymentsSchema = z
  .object({
    expirationMinutes: z.coerce.number().int().min(5).max(10_080),
    cryptocurrencies: z.record(z.string().trim().min(2).max(12), walletSchema),
  })
  .strict()

const systemSchema = z
  .object({
    maintenanceMode: z.boolean(),
    registrationEnabled: z.boolean(),
    searchQueueEnabled: z.boolean(),
    notificationsEnabled: z.boolean(),
  })
  .strict()

const defaults = {
  general: {
    applicationName: 'Ghost Mail Finder',
    supportEmail: 'support@example.com',
  },
  finder: defaultFinderSettings,
  payments: defaultPaymentSettings,
  system: {
    maintenanceMode: false,
    registrationEnabled: true,
    searchQueueEnabled: true,
    notificationsEnabled: true,
  },
}

const schemas = {
  general: generalSchema,
  finder: finderSchema,
  payments: paymentsSchema,
  system: systemSchema,
}

export async function GET(_request: NextRequest, context: { params: Promise<{ section: string }> }) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const { section } = paramsSchema.parse(await context.params)
    const setting = await prisma.systemSetting.findUnique({ where: { key: section } })
    const value = schemas[section].parse(setting?.value ?? defaults[section])
    return NextResponse.json({ section, value, updatedAt: setting?.updatedAt ?? null })
  } catch (error) {
    return apiError(error)
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ section: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { section } = paramsSchema.parse(await context.params)
    const value = schemas[section].parse(await request.json())
    const setting = await prisma.$transaction(async (tx) => {
      const updated = await tx.systemSetting.upsert({
        where: { key: section },
        create: {
          key: section,
          value: value as Prisma.InputJsonObject,
          isPublic: false,
        },
        update: {
          value: value as Prisma.InputJsonObject,
          isPublic: false,
        },
      })
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: 'SETTING_UPDATED',
          targetType: 'SystemSetting',
          targetId: updated.id,
          metadata: { section },
          ipAddress: clientIp(request) ?? undefined,
        },
      })
      return updated
    })
    return NextResponse.json({ section, value: schemas[section].parse(setting.value), updatedAt: setting.updatedAt })
  } catch (error) {
    return apiError(error)
  }
}
