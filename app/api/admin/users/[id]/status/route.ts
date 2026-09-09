import { AccountStatus, UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, apiError, clientIp, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'

const paramsSchema = z.object({ id: z.string().cuid() })
const bodySchema = z.object({
  status: z.enum([AccountStatus.ACTIVE, AccountStatus.DISABLED]),
  reason: z.string().trim().min(3).max(500),
})

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const input = bodySchema.parse(await request.json())
    if (id === admin.id && input.status === AccountStatus.DISABLED) {
      throw new ApiError(409, 'You cannot disable your own account')
    }
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!existing) throw new ApiError(404, 'User not found')

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { status: input.status },
        select: { id: true, name: true, email: true, role: true, status: true, updatedAt: true },
      })
      if (input.status === AccountStatus.DISABLED) {
        await tx.session.deleteMany({ where: { userId: id } })
      }
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: input.status === AccountStatus.DISABLED ? 'USER_DISABLED' : 'USER_ENABLED',
          targetType: 'User',
          targetId: id,
          metadata: { previousStatus: existing.status, reason: input.reason },
          ipAddress: clientIp(request) ?? undefined,
        },
      })
      return updated
    })
    return NextResponse.json({ user })
  } catch (error) {
    return apiError(error)
  }
}
