import { NextRequest, NextResponse } from 'next/server'
import { createSession, hashPassword } from '@/lib/auth'
import { ApiError, apiError, clientIp, rateLimit, requireSameOrigin } from '@/lib/api'
import { ensureDatabase, prisma } from '@/lib/db'
import { getSetting } from '@/lib/settings'
import { registerSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase()
    requireSameOrigin(request)
    rateLimit(`auth:register:${clientIp(request) ?? 'unknown'}`, 5, 60 * 60 * 1000)

    const input = registerSchema.parse(await request.json().catch(() => {
      throw new ApiError(400, 'Invalid request body')
    }))
    const systemSettings = await getSetting('system', { registrationEnabled: true })
    if (!systemSettings.registrationEnabled) throw new ApiError(403, 'Registration is currently disabled')
    const [passwordHash, generalSettings] = await Promise.all([
      hashPassword(input.password),
      getSetting<{ applicationName?: string }>('general', {
        applicationName: 'Ghost Mail Finder',
      }),
    ])

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: 'USER',
          status: 'INACTIVE',
          creditBalance: 0,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          creditBalance: true,
        },
      })

      await tx.notification.create({
        data: {
          userId: created.id,
          type: 'REGISTRATION',
          title: 'Registration complete',
          message: `Welcome to ${generalSettings.applicationName || 'Ghost Mail Finder'}. Your account is awaiting activation.`,
        },
      })
      await tx.auditLog.create({
        data: {
          action: 'USER_CREATED',
          targetType: 'User',
          targetId: created.id,
          metadata: { source: 'registration' },
          ipAddress: clientIp(request) ?? undefined,
        },
      })

      return created
    })

    await createSession(user.id)
    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return apiError(new ApiError(409, 'An account with this email already exists'))
    }
    return apiError(error)
  }
}
