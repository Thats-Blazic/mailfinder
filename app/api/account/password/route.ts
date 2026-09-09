import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, ApiError, requireApiUser, requireSameOrigin } from '@/lib/api'
import { createSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'
import { passwordSchema } from '@/lib/validation'

const schema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireApiUser()
    const input = schema.parse(await request.json())
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new ApiError(400, 'Current password is incorrect')
    }
    const passwordHash = await hashPassword(input.password)
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.auditLog.create({
        data: {
          adminId: user.role === 'ADMIN' ? user.id : undefined,
          action: 'PASSWORD_CHANGED',
          targetType: 'User',
          targetId: user.id,
        },
      }),
    ])
    await createSession(user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error)
  }
}
