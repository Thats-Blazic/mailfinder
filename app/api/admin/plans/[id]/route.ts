import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, apiError, clientIp, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { planSchema } from '@/lib/validation'

const paramsSchema = z.object({ id: z.string().cuid() })

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { userPlans: true, payments: true } } },
    })
    if (!plan) throw new ApiError(404, 'Plan not found')
    return NextResponse.json({ plan })
  } catch (error) {
    return apiError(error)
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const input = planSchema.parse(await request.json())
    const exists = await prisma.plan.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new ApiError(404, 'Plan not found')
    const plan = await prisma.$transaction(async (tx) => {
      const updated = await tx.plan.update({ where: { id }, data: input })
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: 'PLAN_UPDATED',
          targetType: 'Plan',
          targetId: id,
          metadata: { name: updated.name },
          ipAddress: clientIp(request) ?? undefined,
        },
      })
      return updated
    })
    return NextResponse.json({ plan })
  } catch (error) {
    return apiError(error)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const exists = await prisma.plan.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!exists) throw new ApiError(404, 'Plan not found')
    const plan = await prisma.$transaction(async (tx) => {
      const disabled = await tx.plan.update({ where: { id }, data: { active: false } })
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: 'PLAN_DISABLED',
          targetType: 'Plan',
          targetId: id,
          metadata: { name: exists.name },
          ipAddress: clientIp(request) ?? undefined,
        },
      })
      return disabled
    })
    return NextResponse.json({ plan })
  } catch (error) {
    return apiError(error)
  }
}
