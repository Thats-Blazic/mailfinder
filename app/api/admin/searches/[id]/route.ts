import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, apiError, clientIp, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'

const paramsSchema = z.object({ id: z.string().cuid() })
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) })

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const { reason } = reasonSchema.parse(await request.json())
    const existing = await prisma.search.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    })
    if (!existing) throw new ApiError(404, 'Search not found')
    if (!['QUEUED', 'PROCESSING'].includes(existing.status)) {
      throw new ApiError(409, 'Only queued or processing searches can be cancelled')
    }
    const search = await prisma.$transaction(async (tx) => {
      const updated = await tx.search.update({
        where: { id },
        data: { status: 'CANCELLED', completedAt: new Date(), error: reason },
      })
      await tx.scanJob.updateMany({
        where: { domain: { searchId: id }, status: { in: ['QUEUED', 'ACTIVE'] } },
        data: { status: 'FAILED', completedAt: new Date(), lastError: `Cancelled by admin: ${reason}` },
      })
      await tx.domain.updateMany({
        where: { searchId: id, status: { in: ['QUEUED', 'PROCESSING'] } },
        data: { status: 'FAILED', error: `Cancelled by admin: ${reason}` },
      })
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: 'SEARCH_CANCELLED',
          targetType: 'Search',
          targetId: id,
          metadata: { userId: existing.userId, previousStatus: existing.status, reason },
          ipAddress: clientIp(request) ?? undefined,
        },
      })
      return updated
    })
    return NextResponse.json({ search })
  } catch (error) {
    return apiError(error)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const { id } = paramsSchema.parse(await context.params)
    const { reason } = reasonSchema.parse({
      reason: request.nextUrl.searchParams.get('reason'),
    })
    const existing = await prisma.search.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true, name: true },
    })
    if (!existing) throw new ApiError(404, 'Search not found')
    if (['QUEUED', 'PROCESSING'].includes(existing.status)) {
      throw new ApiError(409, 'Cancel an active search before deleting it')
    }
    await prisma.$transaction(async (tx) => {
      await tx.creditTransaction.updateMany({ where: { searchId: id }, data: { searchId: null } })
      await tx.search.delete({ where: { id } })
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: 'SEARCH_DELETED',
          targetType: 'Search',
          targetId: id,
          metadata: { userId: existing.userId, name: existing.name, status: existing.status, reason },
          ipAddress: clientIp(request) ?? undefined,
        },
      })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError(error)
  }
}
