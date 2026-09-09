import { UserRole } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, clientIp, requireApiUser, requireSameOrigin } from '@/lib/api'
import { prisma } from '@/lib/db'
import { planSchema } from '@/lib/validation'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(UserRole.ADMIN)
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams))
    const where = query.active === undefined ? {} : { active: query.active }
    const [plans, total] = await Promise.all([
      prisma.plan.findMany({
        where,
        include: { _count: { select: { userPlans: true, payments: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.plan.count({ where }),
    ])
    return NextResponse.json({
      plans,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.ceil(total / query.pageSize),
      total,
    })
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const admin = await requireApiUser(UserRole.ADMIN)
    const input = planSchema.parse(await request.json())
    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.plan.create({ data: input })
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: 'PLAN_CREATED',
          targetType: 'Plan',
          targetId: created.id,
          metadata: { name: created.name },
          ipAddress: clientIp(request) ?? undefined,
        },
      })
      return created
    })
    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    return apiError(error)
  }
}
