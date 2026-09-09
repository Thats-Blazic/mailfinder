import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, requireApiUser } from '@/lib/api'
import { prisma } from '@/lib/db'

const querySchema = z.object({
  activityLimit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const { activityLimit } = querySchema.parse({
      activityLimit: request.nextUrl.searchParams.get('activityLimit') ?? undefined,
    })
    const now = new Date()

    const [
      totalUsers,
      activeUsers,
      usersWithoutPlan,
      activePlans,
      pendingPayments,
      completedSearches,
      emailsFound,
      creditsUsed,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { plans: { none: { status: 'ACTIVE', expiresAt: { gt: now } } } } }),
      prisma.userPlan.count({ where: { status: 'ACTIVE', expiresAt: { gt: now } } }),
      prisma.payment.count({ where: { status: { in: ['PENDING', 'MORE_INFO_REQUIRED'] } } }),
      prisma.search.count({ where: { status: 'COMPLETED' } }),
      prisma.emailResult.count(),
      prisma.user.aggregate({ _sum: { creditsUsed: true } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: activityLimit,
        include: { admin: { select: { id: true, name: true, email: true } } },
      }),
    ])

    return NextResponse.json({
      stats: {
        totalUsers,
        activeUsers,
        usersWithoutPlan,
        activePlans,
        pendingPayments,
        completedSearches,
        emailsFound,
        creditsUsed: creditsUsed._sum.creditsUsed ?? 0,
      },
      activity: recentActivity,
    })
  } catch (error) {
    return apiError(error)
  }
}
