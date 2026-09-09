import { NextRequest, NextResponse } from 'next/server'
import { createSession, hashPassword, verifyPassword } from '@/lib/auth'
import { ApiError, apiError, clientIp, rateLimit, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { loginSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const ipAddress = clientIp(request)
    rateLimit(`auth:login:ip:${ipAddress ?? 'unknown'}`, 10, 15 * 60 * 1000)

    const input = loginSchema.parse(await request.json().catch(() => {
      throw new ApiError(400, 'Invalid request body')
    }))
    rateLimit(`auth:login:account:${input.email}`, 10, 15 * 60 * 1000)

    const user = await prisma.user.findUnique({ where: { email: input.email } })
    if (!user) {
      // Keep unknown-account requests computationally comparable to password checks.
      await hashPassword(input.password)
      throw new ApiError(401, 'Invalid email or password')
    }

    const passwordIsValid = await verifyPassword(user.passwordHash, input.password)
    if (!passwordIsValid) throw new ApiError(401, 'Invalid email or password')
    if (user.status === 'DISABLED') throw new ApiError(403, 'Account is disabled')

    const loggedInAt = new Date()
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: loggedInAt },
      })

      if (user.role === 'ADMIN') {
        await tx.auditLog.create({
          data: {
            adminId: user.id,
            action: 'ADMIN_LOGIN',
            targetType: 'User',
            targetId: user.id,
            ipAddress: ipAddress ?? undefined,
            metadata: {
              userAgent: request.headers.get('user-agent'),
            },
          },
        })
      }
    })

    await createSession(user.id)
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        creditBalance: user.creditBalance,
        lastLoginAt: loggedInAt,
      },
    })
  } catch (error) {
    return apiError(error)
  }
}
